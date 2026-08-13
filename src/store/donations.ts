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
  photo?: File;
  imagePath?: string;
  donorContact?: string;
  region: string;
  donationMethod: DonationMethod;
  targetSiteId?: string;
}

export interface AiItem {
  name: string;
  category: string;
  quantity: number | null;
}

export interface AiAnalysisResult {
  items: AiItem[];
  needs_review: boolean;
  message: string | null;
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

/** 사진만 스토리지에 올린 뒤 경로를 반환한다. AI 분석 전 미리 업로드할 때 사용. */
export async function uploadDonationPhoto(photo: File): Promise<string> {
  const sb = client();
  const compressed = await compressImage(photo);
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
  const { error } = await sb.storage
    .from('donation-photos')
    .upload(path, compressed, { contentType: 'image/jpeg' });
  if (error) throw new Error(`사진 업로드에 실패했습니다: ${error.message}`);
  return path;
}

/** Edge Function을 통해 Gemini Vision으로 이미지를 분석한다. */
export async function analyzeImage(imagePath: string): Promise<AiAnalysisResult> {
  const sb = client();
  const { data, error } = await sb.functions.invoke('analyze-donation-image', {
    body: { imagePath },
  });
  if (error) throw error;
  if (!data || !Array.isArray((data as AiAnalysisResult).items)) {
    throw new Error('AI 응답 형식이 올바르지 않습니다.');
  }
  return data as AiAnalysisResult;
}

/** 사진을 올리고 기부 요청을 접수한다. imagePath가 있으면 업로드를 건너뛴다. */
export async function createDonation(input: DonationInput): Promise<string> {
  const sb = client();

  let path: string;
  if (input.imagePath) {
    path = input.imagePath;
  } else if (input.photo) {
    const photo = await compressImage(input.photo);
    path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await sb.storage
      .from('donation-photos')
      .upload(path, photo, { contentType: photo.type || 'image/jpeg' });
    if (uploadError) throw new Error(`사진 업로드에 실패했습니다: ${uploadError.message}`);
  } else {
    throw new Error('photo 또는 imagePath가 필요합니다.');
  }

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
