import type { DistrictId, FacilityType, OperationSite, SiteStatus } from '../types';
import { JUST_DREAM_SITES_25, type JustDreamSiteSeed } from './justdream_sites_25';
import { toSiteDisplayName } from './siteDisplayName';

/**
 * 화성형 그냥드림 운영 거점 25개소.
 *
 * 기관명·주소·좌표는 `src/data/justdream_sites_25.ts` (실적 엑셀 기준 source of truth) 를 그대로 쓴다.
 * 이 파일은 거기에 대시보드가 필요로 하는 값만 덧붙인다.
 *   - district      : 좌표를 화성시 행정동 경계와 대조해 확정 (scripts/verify-justdream-coordinates.mjs)
 *   - facilityType  : 복지기관 → 복지관 / 지역사회보장협의체 → (운영 위치인) 행정복지센터
 *   - 재고·수요·유통기한·주요품목 : 대시보드 시연용 수치
 *
 * 주의
 * - 기관명·주소·위경도는 확인된 실제 데이터, 재고·수요·날짜는 시연용 수치입니다.
 * - 런타임에 장소검색 API 를 호출하지 않습니다. 좌표는 전부 정적 값입니다.
 * - '부족' 판정은 수요 예측(sevenDayDemand − inventoryCount)이 아니라 `shortageQuantity`
 *   (담당자가 명시적으로 등록한 부족 수량이라고 가정한 시연 값)로만 계산한다. `sevenDayDemand`
 *   는 상태 계산에 쓰지 않는 참고용 시연 수치로만 남겨 둔다.
 */

/** 유통기한 임박 수량이 이 값 이상이면 임박 상태로 본다. */
export const EXPIRING_THRESHOLD = 20;

/** 기관별 부가 정보. key 는 justdream_sites_25 의 id 와 1:1 로 대응한다. */
interface SiteExtra {
  /** 좌표 → 행정동 → 소속 구 (검증 스크립트 결과) */
  district: DistrictId;
  /** 좌표가 들어간 행정동. 협의체는 기관명의 읍면동과 일치해야 한다. */
  area: string;
  inventoryCount: number;
  /** 참고용 시연 수치. 상태·부족 판정에는 쓰지 않는다(수요 예측 금지). */
  sevenDayDemand: number;
  /** 명시적으로 등록된 부족 수량(시연 값). 없으면(undefined) 부족이 아니다 — 예측하지 않는다. */
  shortageQuantity?: number;
  expiringCount: number;
  lastUpdatedAt: string;
  focusItem: string;
  dataMissing?: boolean;
}

const SITE_EXTRAS: Record<string, SiteExtra> = {
  // ─── 복지기관 9개소 (실제 시설 위치) ───
  'justdream-01': { district: 'dongtan', area: '동탄5동', inventoryCount: 140, sevenDayDemand: 90, expiringCount: 8, lastUpdatedAt: '2026-08-07T09:30:00', focusItem: '즉석밥 세트' },
  'justdream-02': { district: 'dongtan', area: '동탄4동', inventoryCount: 210, sevenDayDemand: 95, expiringCount: 6, lastUpdatedAt: '2026-08-07T09:20:00', focusItem: '쌀 10kg' },
  'justdream-03': { district: 'manse', area: '송산면', inventoryCount: 120, sevenDayDemand: 70, expiringCount: 4, lastUpdatedAt: '2026-08-07T08:50:00', focusItem: '즉석밥 세트' },
  'justdream-04': { district: 'manse', area: '향남읍', inventoryCount: 85, sevenDayDemand: 60, expiringCount: 22, lastUpdatedAt: '2026-08-07T09:05:00', focusItem: '라면 1박스' },
  'justdream-05': { district: 'dongtan', area: '동탄7동', inventoryCount: 60, sevenDayDemand: 80, shortageQuantity: 20, expiringCount: 0, lastUpdatedAt: '2026-08-07T09:15:00', focusItem: '분유 800g' },
  'justdream-06': { district: 'manse', area: '향남읍', inventoryCount: 110, sevenDayDemand: 75, expiringCount: 9, lastUpdatedAt: '2026-08-07T08:45:00', focusItem: '쌀 10kg' },
  'justdream-07': { district: 'manse', area: '남양읍', inventoryCount: 45, sevenDayDemand: 65, shortageQuantity: 20, expiringCount: 0, lastUpdatedAt: '2026-08-06T17:40:00', focusItem: '즉석밥 세트' },
  'justdream-08': { district: 'dongtan', area: '동탄7동', inventoryCount: 160, sevenDayDemand: 70, expiringCount: 12, lastUpdatedAt: '2026-08-07T09:35:00', focusItem: '즉석밥 세트' },
  'justdream-09': { district: 'byeongjeom', area: '화산동', inventoryCount: 95, sevenDayDemand: 55, expiringCount: 5, lastUpdatedAt: '2026-08-07T09:00:00', focusItem: '위생용품 세트' },

  // ─── 지역사회보장협의체 16개소 (해당 읍면동 행정복지센터 위치) ───
  'justdream-10': { district: 'manse', area: '우정읍', inventoryCount: 45, sevenDayDemand: 35, expiringCount: 0, lastUpdatedAt: '2026-08-07T09:05:00', focusItem: '즉석밥 세트' },
  'justdream-11': { district: 'manse', area: '향남읍', inventoryCount: 70, sevenDayDemand: 50, expiringCount: 21, lastUpdatedAt: '2026-08-07T09:10:00', focusItem: '라면 1박스' },
  'justdream-12': { district: 'manse', area: '남양읍', inventoryCount: 30, sevenDayDemand: 50, shortageQuantity: 20, expiringCount: 0, lastUpdatedAt: '2026-08-06T17:00:00', focusItem: '생필품 꾸러미' },
  'justdream-13': { district: 'hyohaeng', area: '봉담읍', inventoryCount: 40, sevenDayDemand: 60, shortageQuantity: 20, expiringCount: 0, lastUpdatedAt: '2026-08-07T08:50:00', focusItem: '위생용품 세트' },
  'justdream-14': { district: 'manse', area: '서신면', inventoryCount: 55, sevenDayDemand: 25, expiringCount: 3, lastUpdatedAt: '2026-08-07T08:40:00', focusItem: '즉석밥 세트' },
  'justdream-15': { district: 'manse', area: '양감면', inventoryCount: 38, sevenDayDemand: 30, expiringCount: 0, lastUpdatedAt: '2026-08-06T18:10:00', focusItem: '라면 1박스' },
  'justdream-16': { district: 'hyohaeng', area: '비봉면', inventoryCount: 42, sevenDayDemand: 28, expiringCount: 6, lastUpdatedAt: '2026-08-07T08:55:00', focusItem: '즉석밥 세트' },
  'justdream-17': { district: 'manse', area: '새솔동', inventoryCount: 55, sevenDayDemand: 40, expiringCount: 21, lastUpdatedAt: '2026-08-07T09:20:00', focusItem: '라면 1박스' },
  'justdream-18': { district: 'hyohaeng', area: '기배동', inventoryCount: 62, sevenDayDemand: 45, expiringCount: 4, lastUpdatedAt: '2026-08-07T09:00:00', focusItem: '즉석밥 세트' },
  'justdream-19': { district: 'byeongjeom', area: '병점1동', inventoryCount: 70, sevenDayDemand: 55, expiringCount: 0, lastUpdatedAt: '2026-08-07T09:00:00', focusItem: '즉석밥 세트' },
  'justdream-20': { district: 'byeongjeom', area: '병점2동', inventoryCount: 48, sevenDayDemand: 52, shortageQuantity: 4, expiringCount: 0, lastUpdatedAt: '2026-08-06T18:20:00', focusItem: '분유 800g' },
  'justdream-21': { district: 'dongtan', area: '동탄4동', inventoryCount: 88, sevenDayDemand: 60, expiringCount: 7, lastUpdatedAt: '2026-08-07T09:25:00', focusItem: '즉석밥 세트' },
  'justdream-22': { district: 'dongtan', area: '동탄6동', inventoryCount: 75, sevenDayDemand: 35, expiringCount: 2, lastUpdatedAt: '2026-08-07T08:35:00', focusItem: '위생용품 세트' },
  'justdream-23': { district: 'dongtan', area: '동탄7동', inventoryCount: 66, sevenDayDemand: 58, expiringCount: 0, lastUpdatedAt: '2026-08-07T09:40:00', focusItem: '라면 1박스' },
  'justdream-24': { district: 'dongtan', area: '동탄8동', inventoryCount: 52, sevenDayDemand: 62, shortageQuantity: 10, expiringCount: 0, lastUpdatedAt: '2026-08-06T18:30:00', focusItem: '즉석밥 세트' },
  'justdream-25': { district: 'dongtan', area: '동탄9동', inventoryCount: 90, sevenDayDemand: 48, expiringCount: 25, lastUpdatedAt: '2026-08-06T18:30:00', focusItem: '분유 800g' },
};

/**
 * 수치로부터 상태를 결정한다. 화면마다 다른 기준이 생기지 않도록 한 곳에서만 계산한다.
 * '부족'은 `shortageQuantity` 가 명시적으로 등록된 경우에만 판정한다 — 수요 예측으로
 * 계산하지 않는다.
 */
function resolveStatus(extra: SiteExtra): SiteStatus {
  if (extra.dataMissing) return 'missing';
  if ((extra.shortageQuantity ?? 0) > 0) return 'shortage';
  if (extra.expiringCount >= EXPIRING_THRESHOLD) return 'expiring';
  return 'normal';
}

/** 협의체는 운영 위치가 읍면동 행정복지센터이므로 시설 유형도 행정복지센터로 본다. */
function resolveFacilityType(seed: JustDreamSiteSeed): FacilityType {
  return seed.category === '복지기관' ? '복지관' : '행정복지센터';
}

export const mockSites: OperationSite[] = JUST_DREAM_SITES_25.map((seed) => {
  const extra = SITE_EXTRAS[seed.id];
  if (!extra) throw new Error(`SITE_EXTRAS 에 ${seed.id} (${seed.name}) 항목이 없습니다.`);
  if (seed.lat === null || seed.lng === null) {
    throw new Error(`${seed.id} (${seed.name}) 좌표가 비어 있습니다.`);
  }

  // '부족'은 예측이 아니라 명시적으로 등록된 수량(shortageQuantity)에서만 계산한다.
  const expectedShortage = extra.dataMissing ? 0 : (extra.shortageQuantity ?? 0);
  return {
    id: seed.id,
    name: seed.name,
    displayName: seed.displayName || toSiteDisplayName(seed.name),
    district: extra.district,
    facilityType: resolveFacilityType(seed),
    address: seed.address ?? undefined,
    latitude: seed.lat,
    longitude: seed.lng,
    status: resolveStatus(extra),
    inventoryCount: extra.inventoryCount,
    sevenDayDemand: extra.sevenDayDemand,
    expectedShortage,
    expiringCount: extra.expiringCount,
    lastUpdatedAt: extra.lastUpdatedAt,
    focusItem: extra.focusItem,
    isDemo: false,
    // 화성시서부종합사회복지관(justdream-03)과 봉담읍행정복지센터(justdream-13)는
    // 국가형·화성형 동시 운영. 나머지 23곳은 화성형 전용.
    programTypes: seed.id === 'justdream-03' || seed.id === 'justdream-13'
      ? ['NATIONAL', 'HWASEONG']
      : ['HWASEONG'],
  };
});

/**
 * 사업장이 속한 읍면동. 좌표 → 행정동 검증 결과(SITE_EXTRAS.area)라 추측값이 아니다.
 * 중앙 재고(v_inventory_status)의 organizationName 과 같은 읍면동 이름 체계를 쓰므로
 * 출고 원장(outboundLedger)이 사업장 출고를 재고 조직에 연결할 때 이 값을 쓴다.
 */
export function siteAreaOf(siteId: string): string | null {
  return SITE_EXTRAS[siteId]?.area ?? null;
}

export function getSiteById(id: string | null): OperationSite | null {
  if (!id) return null;
  return mockSites.find((site) => site.id === id) ?? null;
}

export function getSitesByDistrict(district: DistrictId | null): OperationSite[] {
  if (!district) return mockSites;
  return mockSites.filter((site) => site.district === district);
}
