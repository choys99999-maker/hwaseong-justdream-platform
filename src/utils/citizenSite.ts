import { mockSites } from '../data/mockSites';
import type { SiteQuickStatus, SiteAvailability } from '../store/citizenSites';
import { distanceKm, type LatLng } from '../lib/geo';
import type { DistrictId, SiteStatus } from '../types';

export type { SiteAvailability };

/** 시민 화면이 쓰는 3단계 상태. 색만으로 전달하지 않도록 항상 아이콘+문구 세트로 렌더한다. */
export const AVAILABILITY_LABEL: Record<SiteAvailability, string> = {
  available: '지금 받을 수 있어요',
  low: '얼마 안 남았어요',
  unknown: '최신 정보 확인이 필요해요',
};

/** 관리자 재고 상태(SiteStatus)를 시민 3단계로 접는다. 새 판정을 만들지 않고 있는 값만 재분류한다. */
function availabilityFromSiteStatus(status: SiteStatus): SiteAvailability {
  if (status === 'missing') return 'unknown';
  if (status === 'shortage') return 'low';
  return 'available'; // normal | expiring — 물건 자체는 아직 있다
}

export interface CitizenSite {
  id: string;
  name: string;
  displayName: string;
  address: string | null;
  phone: string | null;
  district: DistrictId;
  lat: number;
  lng: number;
  availability: SiteAvailability;
  focusItem: string | null;
  updatedAt: string;
  /** true면 현장 담당자가 남긴 실제 값(site_quick_status), false면 아직 입력 전이라 시연 기본값을 보여주는 중 */
  hasLiveStatus: boolean;
}

/**
 * 거점 25곳을 시민 화면 모델로 만든다.
 * 이름·주소·좌표는 항상 `mockSites`(justdream_sites_25 기준, 실제 확인된 값) 그대로 쓰고,
 * "지금 상태"만 현장 담당자가 입력한 값(overrides)이 있으면 그걸로, 없으면 시연 기본값으로 채운다.
 */
export function buildCitizenSites(overrides: Map<string, SiteQuickStatus>): CitizenSite[] {
  return mockSites.map((site) => {
    const live = overrides.get(site.id);
    const base = {
      id: site.id,
      name: site.name,
      displayName: site.displayName,
      address: site.address ?? null,
      phone: site.phone ?? null,
      district: site.district,
      lat: site.latitude,
      lng: site.longitude,
    };
    if (live) {
      return {
        ...base,
        availability: live.availability,
        focusItem: live.focusItem,
        updatedAt: live.updatedAt,
        hasLiveStatus: true,
      };
    }
    return {
      ...base,
      availability: availabilityFromSiteStatus(site.status),
      focusItem: site.focusItem || null,
      updatedAt: site.lastUpdatedAt,
      hasLiveStatus: false,
    };
  });
}

export interface RankedCitizenSite extends CitizenSite {
  distanceKm: number | null;
}

const AVAILABILITY_RANK: Record<SiteAvailability, number> = { available: 0, low: 1, unknown: 2 };

/**
 * 추천 정렬. 기준(우선순위 순):
 *   1~2. 최신 정보·받을 수 있는 품목 존재 여부 (availability: available > low > unknown)
 *   3. 거리 (origin 이 있을 때만)
 *   4. 마지막 갱신 시각 (최근 순)
 * 시간대별 소진 예측이나 확률은 쓰지 않는다 — 그런 데이터 자체가 없다.
 */
export function rankCitizenSites(sites: CitizenSite[], origin: LatLng | null): RankedCitizenSite[] {
  return sites
    .map((site) => ({
      ...site,
      distanceKm: origin ? distanceKm(origin, { lat: site.lat, lng: site.lng }) : null,
    }))
    .sort((a, b) => {
      const availabilityDiff = AVAILABILITY_RANK[a.availability] - AVAILABILITY_RANK[b.availability];
      if (availabilityDiff !== 0) return availabilityDiff;
      if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

/** 시민 홈이 보여줄 추천 최대 3곳. */
export function recommendCitizenSites(
  sites: CitizenSite[],
  origin: LatLng | null,
  limit = 3,
): RankedCitizenSite[] {
  return rankCitizenSites(sites, origin).slice(0, limit);
}

/** "가까워서" 라고 말할 수 있는 한계. 이보다 멀면 근거로 쓰지 않는다. */
const NEARBY_KM = 5;

/**
 * 1순위 카드 아래 한 줄로 붙는 추천 근거.
 * 정렬에 실제로 쓴 사실만 문장으로 옮긴다 — 점수·확률·예상 소진 시각 같은
 * 뒷받침 데이터가 없는 표현은 만들지 않는다. 근거가 하나도 없으면 null 을 준다.
 */
export function recommendReason(site: RankedCitizenSite, today: string): string | null {
  // 조각마다 연결형(중간)과 종결형(마지막)을 함께 들고 있어야 어떤 조합에서도 문장이 자연스럽다.
  const parts: { mid: string; end: string }[] = [];
  if (site.distanceKm !== null && site.distanceKm <= NEARBY_KM) {
    parts.push({ mid: '가깝고', end: '가까워요' });
  }
  if (site.updatedAt.slice(0, 10) === today) {
    parts.push({ mid: '오늘 확인한 정보가 있고', end: '오늘 확인한 정보가 있어요' });
  }
  if (site.availability === 'available') {
    parts.push({ mid: '지금 받을 물품이 있고', end: '지금 받을 물품이 있어요' });
  } else if (site.availability === 'low') {
    parts.push({ mid: '아직 남은 물품이 있고', end: '아직 남은 물품이 있어요' });
  }

  if (parts.length === 0) return null;
  return parts.map((p, i) => (i === parts.length - 1 ? p.end : p.mid)).join(' · ');
}
