// 물품 기부 접근 계층. help_requests와 같은 원칙 — 단일 표 + RPC 하나로 접수하고
// 관리자 대시보드가 status='NEW'를 큐로 읽는다. 사진은 Storage(`donation-photos`)에 먼저 올린 뒤
// 그 경로만 표에 남긴다.
import { supabase } from '../lib/supabase';
import { compressImage } from '../utils/image';

function client() {
  if (!supabase) throw new Error('중앙 저장소가 설정되지 않았습니다.');
  return supabase;
}

export type DonationMethod = 'SELF_DELIVER' | 'PICKUP_NEEDED';
export type DonationStatus = 'NEW' | 'DONE';

export interface Donation {
  id: string;
  itemName: string;
  quantity: number;
  imagePath: string;
  donorContact: string | null;
  region: string;
  donationMethod: DonationMethod;
  targetSiteId: string | null;
  status: DonationStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface DonationInput {
  itemName: string;
  quantity: number;
  photo: File;
  donorContact?: string;
  region: string;
  donationMethod: DonationMethod;
  targetSiteId?: string;
}

function toDonation(r: Record<string, unknown>): Donation {
  return {
    id: String(r.id),
    itemName: String(r.item_name),
    quantity: Number(r.quantity),
    imagePath: String(r.image_path),
    donorContact: (r.donor_contact as string) ?? null,
    region: String(r.region),
    donationMethod: r.donation_method as DonationMethod,
    targetSiteId: (r.target_site_id as string) ?? null,
    status: r.status as DonationStatus,
    createdAt: String(r.created_at),
    resolvedAt: (r.resolved_at as string) ?? null,
  };
}

/** 사진을 올리고 기부 요청을 접수한다. 업로드가 실패하면 표에는 아무것도 남지 않는다. */
export async function createDonation(input: DonationInput): Promise<string> {
  const sb = client();
  const photo = await compressImage(input.photo);
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;

  const { error: uploadError } = await sb.storage
    .from('donation-photos')
    .upload(path, photo, { contentType: photo.type || 'image/jpeg' });
  if (uploadError) throw new Error(`사진 업로드에 실패했습니다: ${uploadError.message}`);

  const { data, error } = await sb.rpc('create_donation', {
    p_item_name: input.itemName,
    p_quantity: input.quantity,
    p_image_path: path,
    p_donor_contact: input.donorContact ?? null,
    p_region: input.region,
    p_donation_method: input.donationMethod,
    p_target_site_id: input.targetSiteId ?? null,
  });
  if (error) throw new Error(`기부 접수에 실패했습니다: ${error.message}`);
  return data as string;
}

/** 기부 사진 미리보기용 서명 URL. 버킷이 비공개라 경로만으로는 바로 볼 수 없다. */
export async function getDonationPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await client().storage.from('donation-photos').createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

/** 관리자 대시보드 "오늘 들어온 기부"가 읽는 목록. */
export async function listDonations(): Promise<Donation[]> {
  const { data, error } = await client()
    .from('donations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`기부 목록을 불러오지 못했습니다: ${error.message}`);
  return (data ?? []).map(toDonation);
}

/** 담당자가 기부를 확인 처리한다. */
export async function resolveDonation(id: string): Promise<void> {
  const { error } = await client().rpc('resolve_donation', { p_id: id });
  if (error) throw new Error(`처리에 실패했습니다: ${error.message}`);
}
