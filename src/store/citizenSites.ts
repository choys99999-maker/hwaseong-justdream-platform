// 거점 빠른 현황 접근 계층.
// 거점 자체(이름·주소·좌표)는 `src/data/mockSites.ts`(justdream_sites_25 기준)가 그대로 source of
// truth다. 이 계층은 현장 담당자가 남긴 "지금 상태" 오버레이 1행(site_id 당 최대 1개)만 다룬다.
import { supabase } from '../lib/supabase';

function client() {
  if (!supabase) throw new Error('중앙 저장소가 설정되지 않았습니다.');
  return supabase;
}

export type SiteAvailability = 'available' | 'low' | 'unknown';

export interface SiteQuickStatus {
  siteId: string;
  availability: SiteAvailability;
  focusItem: string | null;
  note: string | null;
  updatedAt: string;
}

export interface SiteQuickStatusInput {
  siteId: string;
  availability: SiteAvailability;
  focusItem?: string;
  note?: string;
}

function toSiteQuickStatus(r: Record<string, unknown>): SiteQuickStatus {
  return {
    siteId: String(r.site_id),
    availability: r.availability as SiteAvailability,
    focusItem: (r.focus_item as string) ?? null,
    note: (r.note as string) ?? null,
    updatedAt: String(r.updated_at),
  };
}

/** 현장 담당자가 남긴 거점별 최신 상태. 행이 없는 거점은 시연 기본값(mockSites)으로 대체해 보여준다. */
export async function listSiteQuickStatus(): Promise<Map<string, SiteQuickStatus>> {
  const { data, error } = await client().from('site_quick_status').select('*');
  if (error) throw new Error(`거점 현황을 불러오지 못했습니다: ${error.message}`);
  const map = new Map<string, SiteQuickStatus>();
  for (const row of data ?? []) {
    const status = toSiteQuickStatus(row);
    map.set(status.siteId, status);
  }
  return map;
}

/** 빠른 재고 입력 화면에서 저장 버튼 하나로 호출한다. site_id 기준 upsert. */
export async function upsertSiteQuickStatus(input: SiteQuickStatusInput): Promise<void> {
  const { error } = await client().rpc('upsert_site_quick_status', {
    p_site_id: input.siteId,
    p_availability: input.availability,
    p_focus_item: input.focusItem ?? null,
    p_note: input.note ?? null,
  });
  if (error) throw new Error(`거점 현황 저장에 실패했습니다: ${error.message}`);
}
