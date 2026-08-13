// 도움 요청 큐 접근 계층.
// 시민이 `/help`에서 직접 넣거나 담당자가 전화를 받아 대신 넣거나, 저장 방식은 하나다 —
// channel 로만 구분하고 같은 표(help_requests)/같은 RPC를 쓴다.
import { supabase } from '../lib/supabase';
import type { ItemCategory } from '../types';

function client() {
  if (!supabase) throw new Error('중앙 저장소가 설정되지 않았습니다.');
  return supabase;
}

export type HelpRequestChannel = 'CITIZEN' | 'PHONE';
export type HelpRequestStatus = 'NEW' | 'DONE';
/** 직접 갈 수 있어요(SELF) / 전달 도움이 필요해요(DELIVERY). 전화 대리 입력은 굳이 묻지 않아도 된다. */
export type HelpRequestType = 'SELF' | 'DELIVERY';

export interface HelpRequest {
  id: string;
  phone: string;
  dong: string;
  itemCategory: ItemCategory;
  message: string | null;
  channel: HelpRequestChannel;
  requestType: HelpRequestType | null;
  preferredSiteId: string | null;
  status: HelpRequestStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface HelpRequestInput {
  phone: string;
  dong: string;
  itemCategory: ItemCategory;
  message?: string;
  channel?: HelpRequestChannel;
  requestType?: HelpRequestType;
  preferredSiteId?: string;
}

function toHelpRequest(r: Record<string, unknown>): HelpRequest {
  return {
    id: String(r.id),
    phone: String(r.phone),
    dong: String(r.dong),
    itemCategory: r.item_category as ItemCategory,
    message: (r.message as string) ?? null,
    channel: r.channel as HelpRequestChannel,
    requestType: (r.request_type as HelpRequestType) ?? null,
    preferredSiteId: (r.preferred_site_id as string) ?? null,
    status: r.status as HelpRequestStatus,
    createdAt: String(r.created_at),
    resolvedAt: (r.resolved_at as string) ?? null,
  };
}

/** 도움 요청 접수. 시민 직접 입력(`CITIZEN`)과 전화 대리 입력(`PHONE`) 모두 이 함수 하나로 들어간다. */
export async function createHelpRequest(input: HelpRequestInput): Promise<string> {
  const { data, error } = await client().rpc('create_help_request', {
    p_phone: input.phone,
    p_dong: input.dong,
    p_item_category: input.itemCategory,
    p_message: input.message ?? null,
    p_channel: input.channel ?? 'CITIZEN',
    p_request_type: input.requestType ?? null,
    p_preferred_site_id: input.preferredSiteId ?? null,
  });
  if (error) throw new Error(`요청 접수에 실패했습니다: ${error.message}`);
  return data as string;
}

/** 관리자 대시보드 "오늘 확인할 요청"이 읽는 목록. 최신 접수가 먼저 온다. */
export async function listHelpRequests(): Promise<HelpRequest[]> {
  const { data, error } = await client()
    .from('help_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`도움 요청 목록을 불러오지 못했습니다: ${error.message}`);
  return (data ?? []).map(toHelpRequest);
}

/** 담당자가 요청을 확인 처리한다. */
export async function resolveHelpRequest(id: string): Promise<void> {
  const { error } = await client().rpc('resolve_help_request', { p_id: id });
  if (error) throw new Error(`요청 처리에 실패했습니다: ${error.message}`);
}
