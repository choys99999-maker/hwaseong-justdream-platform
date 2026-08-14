import type { OperationSite } from '../types';
import type { SiteQuickStatus } from '../store/citizenSites';
import { mockSites } from '../data/mockSites';

/**
 * 거점 한 곳의 "지금 상태" 한 줄.
 *
 * 두 층을 겹쳐 놓는다.
 *   - 현장 입력(site_quick_status) : 담당자가 실제로 누른 값. 시민 화면이 보는 값과 같다.
 *   - 운영 신호(mockSites)         : 부족·유통기한 임박 판정. 아직 시연 수치다.
 * 둘을 합치지 않고 나란히 두는 이유는 하나가 실제 값이고 하나가 시연 값이기 때문이다.
 */
export interface SiteOperationRow {
  site: OperationSite;
  quickStatus: SiteQuickStatus | null;
  /** 마지막 현장 입력 이후 경과 시간. 입력이 한 번도 없으면 null */
  hoursSinceUpdate: number | null;
  /** 현장 입력이 없거나 오래돼 갱신이 필요한 상태 */
  needsUpdate: boolean;
}

/** 이 시간을 넘기면 "정보 갱신 필요"로 본다. 하루 한 번은 눌러 달라는 뜻이다. */
export const STALE_HOURS = 24;

function hoursSince(iso: string, now: number): number {
  return Math.floor((now - new Date(iso).getTime()) / 3_600_000);
}

export function buildSiteRows(
  quickStatusMap: Map<string, SiteQuickStatus> | null,
  now: number = Date.now(),
): SiteOperationRow[] {
  return mockSites.map((site) => {
    const quickStatus = quickStatusMap?.get(site.id) ?? null;
    const hoursSinceUpdate = quickStatus ? hoursSince(quickStatus.updatedAt, now) : null;
    return {
      site,
      quickStatus,
      hoursSinceUpdate,
      needsUpdate: hoursSinceUpdate === null || hoursSinceUpdate >= STALE_HOURS,
    };
  });
}

/** "18시간 미갱신" / "현장 입력 없음" — 목록과 조치 행이 같은 문구를 쓴다. */
export function updateGapLabel(row: SiteOperationRow): string {
  if (row.hoursSinceUpdate === null) return '현장 입력 없음';
  if (row.hoursSinceUpdate < 1) return '방금 갱신';
  if (row.hoursSinceUpdate < 48) return `${row.hoursSinceUpdate}시간 미갱신`;
  return `${Math.floor(row.hoursSinceUpdate / 24)}일 미갱신`;
}
