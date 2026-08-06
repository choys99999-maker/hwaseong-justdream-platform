import type { FacilityType, DistrictId, OperationSite, SiteStatus } from '../types';

/**
 * 화성형 그냥드림 거점 합성 데이터 (MVP 데모용).
 *
 * 주의
 * - 모든 수치는 합성 데이터입니다. 실제 운영 데이터가 아닙니다.
 * - 시설명은 실제 존재하는 행정복지센터 명칭을 사용했고, 구 소속은 통계청 행정동 경계
 *   (`src/data/geo/README.md` 참고)의 `sggnm` 값을 그대로 따랐습니다. 임의로 바꾸지 않았습니다.
 * - 좌표는 해당 행정동 **경계의 중심점**입니다. 실제 청사 위치가 아니므로 모든 거점을
 *   `isDemo: true` 로 표시하고 화면에도 '데모' 배지를 노출합니다.
 *   (중심점은 `scripts/build-hwaseong-districts.mjs` 실행 결과에서 가져왔습니다.)
 * - 복지관 거점은 실제 시설을 특정하지 않은 데모 거점입니다.
 */

/** 유통기한 임박 수량이 이 값 이상이면 임박 상태로 본다. */
export const EXPIRING_THRESHOLD = 20;
/** 7일 수요 대비 이 배수 이상 보유하면 과잉 재고로 본다. */
export const SURPLUS_RATIO = 2;

interface SiteSeed {
  id: string;
  name: string;
  district: DistrictId;
  facilityType: FacilityType;
  /** 행정동 경계 중심점 [위도, 경도] */
  latitude: number;
  longitude: number;
  inventoryCount: number;
  sevenDayDemand: number;
  expiringCount: number;
  lastUpdatedAt: string;
  focusItem: string;
  /** 데이터 미입력(집계 누락) 거점 */
  dataMissing?: boolean;
}

const SITE_SEEDS: SiteSeed[] = [
  // 만세구 — 향남·남양·우정 중심
  {
    id: 'site-manse-01',
    name: '향남읍 행정복지센터',
    district: 'manse',
    facilityType: '행정복지센터',
    latitude: 37.114309,
    longitude: 126.927036,
    inventoryCount: 180,
    sevenDayDemand: 90,
    expiringCount: 8,
    lastUpdatedAt: '2026-08-06T09:20:00',
    focusItem: '즉석밥 세트',
  },
  {
    id: 'site-manse-02',
    name: '남양읍 행정복지센터',
    district: 'manse',
    facilityType: '행정복지센터',
    latitude: 37.208244,
    longitude: 126.821504,
    inventoryCount: 40,
    sevenDayDemand: 75,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-06T08:40:00',
    focusItem: '즉석밥 세트',
  },
  {
    id: 'site-manse-03',
    name: '우정읍 행정복지센터',
    district: 'manse',
    facilityType: '행정복지센터',
    latitude: 37.080107,
    longitude: 126.78917,
    inventoryCount: 62,
    sevenDayDemand: 48,
    expiringCount: 26,
    lastUpdatedAt: '2026-08-05T17:10:00',
    focusItem: '쌀 10kg',
  },
  {
    id: 'site-manse-04',
    name: '만세구 종합사회복지관',
    district: 'manse',
    facilityType: '복지관',
    latitude: 37.229975,
    longitude: 126.718832,
    inventoryCount: 0,
    sevenDayDemand: 40,
    expiringCount: 0,
    lastUpdatedAt: '2026-07-24T14:05:00',
    focusItem: '생필품 꾸러미',
    dataMissing: true,
  },

  // 효행구 — 봉담·정남·매송 중심
  {
    id: 'site-hyohaeng-01',
    name: '봉담읍 행정복지센터',
    district: 'hyohaeng',
    facilityType: '행정복지센터',
    latitude: 37.204209,
    longitude: 126.939102,
    inventoryCount: 120,
    sevenDayDemand: 60,
    expiringCount: 5,
    lastUpdatedAt: '2026-08-06T09:05:00',
    focusItem: '라면 1박스',
  },
  {
    id: 'site-hyohaeng-02',
    name: '정남면 행정복지센터',
    district: 'hyohaeng',
    facilityType: '행정복지센터',
    latitude: 37.16159,
    longitude: 126.986236,
    inventoryCount: 28,
    sevenDayDemand: 52,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-05T16:30:00',
    focusItem: '라면 1박스',
  },
  {
    id: 'site-hyohaeng-03',
    name: '효행구 노인복지관',
    district: 'hyohaeng',
    facilityType: '복지관',
    latitude: 37.263268,
    longitude: 126.907226,
    inventoryCount: 96,
    sevenDayDemand: 55,
    expiringCount: 12,
    lastUpdatedAt: '2026-08-06T08:55:00',
    focusItem: '위생용품 세트',
  },

  // 병점구 — 병점·진안·반월 중심
  {
    id: 'site-byeongjeom-01',
    name: '병점1동 행정복지센터',
    district: 'byeongjeom',
    facilityType: '행정복지센터',
    latitude: 37.203376,
    longitude: 127.035435,
    inventoryCount: 34,
    sevenDayDemand: 46,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-06T09:15:00',
    focusItem: '생리대 세트',
  },
  {
    id: 'site-byeongjeom-02',
    name: '진안동 행정복지센터',
    district: 'byeongjeom',
    facilityType: '행정복지센터',
    latitude: 37.22175,
    longitude: 127.037095,
    inventoryCount: 130,
    sevenDayDemand: 58,
    expiringCount: 6,
    lastUpdatedAt: '2026-08-06T08:35:00',
    focusItem: '생리대 세트',
  },
  {
    id: 'site-byeongjeom-03',
    name: '반월동 행정복지센터',
    district: 'byeongjeom',
    facilityType: '행정복지센터',
    latitude: 37.226954,
    longitude: 127.060336,
    inventoryCount: 70,
    sevenDayDemand: 44,
    expiringCount: 24,
    lastUpdatedAt: '2026-08-05T18:00:00',
    focusItem: '통조림 세트',
  },

  // 동탄구 — 동탄 신도시 생활권
  {
    id: 'site-dongtan-01',
    name: '동탄1동 행정복지센터',
    district: 'dongtan',
    facilityType: '행정복지센터',
    latitude: 37.210275,
    longitude: 127.074142,
    inventoryCount: 88,
    sevenDayDemand: 40,
    expiringCount: 18,
    lastUpdatedAt: '2026-08-06T09:30:00',
    focusItem: '분유 800g',
  },
  {
    id: 'site-dongtan-02',
    name: '동탄4동 행정복지센터',
    district: 'dongtan',
    facilityType: '행정복지센터',
    latitude: 37.195638,
    longitude: 127.111932,
    inventoryCount: 150,
    sevenDayDemand: 62,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-06T09:10:00',
    focusItem: '라면 1박스',
  },
  {
    id: 'site-dongtan-03',
    name: '동탄5동 행정복지센터',
    district: 'dongtan',
    facilityType: '행정복지센터',
    latitude: 37.209326,
    longitude: 127.123617,
    inventoryCount: 42,
    sevenDayDemand: 62,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-06T08:50:00',
    focusItem: '라면 1박스',
  },
  {
    id: 'site-dongtan-04',
    name: '동탄8동 행정복지센터',
    district: 'dongtan',
    facilityType: '행정복지센터',
    latitude: 37.154975,
    longitude: 127.111835,
    inventoryCount: 24,
    sevenDayDemand: 30,
    expiringCount: 4,
    lastUpdatedAt: '2026-08-05T17:45:00',
    focusItem: '분유 800g',
  },
];

/** 수치로부터 상태를 결정한다. 화면마다 다른 기준이 생기지 않도록 한 곳에서만 계산한다. */
function resolveStatus(seed: SiteSeed, expectedShortage: number): SiteStatus {
  if (seed.dataMissing) return 'missing';
  if (expectedShortage > 0) return 'shortage';
  if (seed.expiringCount >= EXPIRING_THRESHOLD) return 'expiring';
  if (seed.inventoryCount >= seed.sevenDayDemand * SURPLUS_RATIO) return 'surplus';
  return 'normal';
}

export const mockSites: OperationSite[] = SITE_SEEDS.map((seed) => {
  const expectedShortage = seed.dataMissing ? 0 : Math.max(0, seed.sevenDayDemand - seed.inventoryCount);
  return {
    id: seed.id,
    name: seed.name,
    district: seed.district,
    facilityType: seed.facilityType,
    latitude: seed.latitude,
    longitude: seed.longitude,
    status: resolveStatus(seed, expectedShortage),
    inventoryCount: seed.inventoryCount,
    sevenDayDemand: seed.sevenDayDemand,
    expectedShortage,
    expiringCount: seed.expiringCount,
    lastUpdatedAt: seed.lastUpdatedAt,
    focusItem: seed.focusItem,
    isDemo: true,
  };
});

export function getSiteById(id: string | null): OperationSite | null {
  if (!id) return null;
  return mockSites.find((site) => site.id === id) ?? null;
}

export function getSitesByDistrict(district: DistrictId | null): OperationSite[] {
  if (!district) return mockSites;
  return mockSites.filter((site) => site.district === district);
}
