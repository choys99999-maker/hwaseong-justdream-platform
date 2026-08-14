/**
 * 시민용 그냥드림 플랫폼 데이터
 * 기존 mockSites.ts 의 실제 거점 좌표·주소를 재사용하고
 * 시민이 확인할 물품별 재고 정보를 추가한 구조.
 * 추후 관리자 플랫폼과 API로 연결 시 이 인터페이스를 그대로 사용한다.
 */

export type StockStatus = 'many' | 'normal' | 'few' | 'none';
export type ItemCategory = 'food' | 'household' | 'hygiene' | 'clothing' | 'other';
export type SiteOverallStatus = 'good' | 'fair' | 'low' | 'empty';

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  many: '많음',
  normal: '보통',
  few: '적음',
  none: '없음',
};

export const STOCK_STATUS_COLORS: Record<StockStatus, string> = {
  many: '#16a34a',
  normal: '#d97706',
  few: '#dc2626',
  none: '#9ca3af',
};

export const SITE_OVERALL_STATUS_LABELS: Record<SiteOverallStatus, string> = {
  good: '재고 많음',
  fair: '재고 보통',
  low: '재고 적음',
  empty: '재고 없음',
};

export const SITE_OVERALL_STATUS_COLORS: Record<SiteOverallStatus, string> = {
  good: '#16a34a',
  fair: '#d97706',
  low: '#dc2626',
  empty: '#9ca3af',
};

export const SITE_OVERALL_STATUS_BG: Record<SiteOverallStatus, string> = {
  good: '#dcfce7',
  fair: '#fef3c7',
  low: '#fee2e2',
  empty: '#f3f4f6',
};

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  food: '먹거리',
  household: '생활용품',
  hygiene: '위생용품',
  clothing: '의류',
  other: '기타',
};

export const CATEGORY_EMOJIS: Record<ItemCategory, string> = {
  food: '🍚',
  household: '🧹',
  hygiene: '🧴',
  clothing: '👕',
  other: '📦',
};

export interface CitizenItem {
  id: string;
  name: string;
  emoji: string;
  category: ItemCategory;
  stockStatus: StockStatus;
}

export interface CitizenSite {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  operatingHours: string;
  operatingDays: string;
  overallStatus: SiteOverallStatus;
  items: CitizenItem[];
  lastUpdated: string;
  facilityType: string;
}

/** 현재 시간 기준 운영 여부를 동적으로 계산 */
export function isCurrentlyOpen(site: CitizenSite): boolean {
  const now = new Date();
  const day = now.getDay(); // 0=일, 6=토
  const hour = now.getHours();
  const minute = now.getMinutes();
  const currentMinutes = hour * 60 + minute;

  if (site.operatingDays === '평일') {
    if (day === 0 || day === 6) return false;
  }

  // 09:00 ~ 18:00 기준 (간단 파싱)
  const match = site.operatingHours.match(/(\d{2}):(\d{2})\s*~\s*(\d{2}):(\d{2})/);
  if (!match) return false;
  const openMin = parseInt(match[1]) * 60 + parseInt(match[2]);
  const closeMin = parseInt(match[3]) * 60 + parseInt(match[4]);
  return currentMinutes >= openMin && currentMinutes < closeMin;
}

/** 두 좌표 사이의 직선거리 (km) */
export function calcDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

export const citizenSites: CitizenSite[] = [
  // ── 효행구 ──
  {
    id: 'site-national-hyohaeng-01',
    name: '경기나눔푸드뱅크',
    address: '경기도 화성시 효행구 정남면 괘랑1길 42-30',
    lat: 37.1819936236881,
    lng: 126.983960756777,
    phone: '031-294-1377',
    operatingHours: '09:00 ~ 17:00',
    operatingDays: '평일',
    overallStatus: 'good',
    facilityType: '푸드뱅크',
    lastUpdated: '2026-08-14T09:00:00',
    items: [
      { id: 'i01-01', name: '즉석밥', emoji: '🍚', category: 'food', stockStatus: 'many' },
      { id: 'i01-02', name: '라면', emoji: '🍜', category: 'food', stockStatus: 'many' },
      { id: 'i01-03', name: '통조림', emoji: '🥫', category: 'food', stockStatus: 'many' },
      { id: 'i01-04', name: '쌀 (10kg)', emoji: '🌾', category: 'food', stockStatus: 'normal' },
      { id: 'i01-05', name: '분유', emoji: '🍼', category: 'food', stockStatus: 'normal' },
      { id: 'i01-06', name: '화장지', emoji: '🧻', category: 'household', stockStatus: 'many' },
    ],
  },
  {
    id: 'site-national-hyohaeng-02',
    name: '봉담아리푸드뱅크',
    address: '경기도 화성시 효행구 봉담읍 덕머루서길 9-9',
    lat: 37.1672006059062,
    lng: 126.931875079111,
    phone: '010-5089-1377',
    operatingHours: '09:00 ~ 18:00',
    operatingDays: '평일',
    overallStatus: 'good',
    facilityType: '푸드뱅크',
    lastUpdated: '2026-08-14T09:10:00',
    items: [
      { id: 'i02-01', name: '즉석밥', emoji: '🍚', category: 'food', stockStatus: 'many' },
      { id: 'i02-02', name: '라면', emoji: '🍜', category: 'food', stockStatus: 'many' },
      { id: 'i02-03', name: '통조림', emoji: '🥫', category: 'food', stockStatus: 'normal' },
      { id: 'i02-04', name: '세제', emoji: '🧼', category: 'household', stockStatus: 'normal' },
      { id: 'i02-05', name: '마스크', emoji: '😷', category: 'hygiene', stockStatus: 'many' },
    ],
  },
  {
    id: 'site-hwaseong-hyohaeng-01',
    name: '봉담읍행정복지센터',
    address: '경기도 화성시 효행구 봉담읍 샘마을1길 7',
    lat: 37.220170763667,
    lng: 126.950294728924,
    phone: '031-369-5900',
    operatingHours: '09:00 ~ 18:00',
    operatingDays: '평일',
    overallStatus: 'low',
    facilityType: '행정복지센터',
    lastUpdated: '2026-08-14T08:50:00',
    items: [
      { id: 'i03-01', name: '즉석밥', emoji: '🍚', category: 'food', stockStatus: 'few' },
      { id: 'i03-02', name: '라면', emoji: '🍜', category: 'food', stockStatus: 'normal' },
      { id: 'i03-03', name: '위생용품', emoji: '🧴', category: 'hygiene', stockStatus: 'few' },
      { id: 'i03-04', name: '생리대', emoji: '🩸', category: 'hygiene', stockStatus: 'none' },
    ],
  },

  // ── 동탄구 ──
  {
    id: 'site-national-dongtan-01',
    name: '화성시나래울푸드마켓',
    address: '경기도 화성시 동탄구 여울로2길 33',
    lat: 37.205154956069,
    lng: 127.05116570593,
    phone: '031-8077-9090',
    operatingHours: '09:00 ~ 18:00',
    operatingDays: '평일',
    overallStatus: 'good',
    facilityType: '푸드뱅크',
    lastUpdated: '2026-08-14T09:30:00',
    items: [
      { id: 'i04-01', name: '즉석밥', emoji: '🍚', category: 'food', stockStatus: 'many' },
      { id: 'i04-02', name: '라면', emoji: '🍜', category: 'food', stockStatus: 'many' },
      { id: 'i04-03', name: '통조림', emoji: '🥫', category: 'food', stockStatus: 'normal' },
      { id: 'i04-04', name: '생리대', emoji: '🩸', category: 'hygiene', stockStatus: 'normal' },
      { id: 'i04-05', name: '화장지', emoji: '🧻', category: 'household', stockStatus: 'many' },
    ],
  },
  {
    id: 'site-national-dongtan-02',
    name: '화성은혜푸드뱅크',
    address: '경기도 화성시 동탄구 동탄하나3길 7-5',
    lat: 37.2137328822513,
    lng: 127.063426077177,
    phone: '031-8003-6004',
    operatingHours: '09:00 ~ 17:00',
    operatingDays: '평일',
    overallStatus: 'low',
    facilityType: '푸드뱅크',
    lastUpdated: '2026-08-14T09:15:00',
    items: [
      { id: 'i05-01', name: '즉석밥', emoji: '🍚', category: 'food', stockStatus: 'normal' },
      { id: 'i05-02', name: '라면', emoji: '🍜', category: 'food', stockStatus: 'few' },
      { id: 'i05-03', name: '분유', emoji: '🍼', category: 'food', stockStatus: 'few' },
      { id: 'i05-04', name: '화장지', emoji: '🧻', category: 'household', stockStatus: 'normal' },
    ],
  },
  {
    id: 'site-hwaseong-dongtan-01',
    name: '동탄9동행정복지센터',
    address: '경기도 화성시 동탄구 동탄신리천로9길 76',
    lat: 37.1807553384457,
    lng: 127.138602632255,
    phone: '031-369-5990',
    operatingHours: '09:00 ~ 18:00',
    operatingDays: '평일',
    overallStatus: 'good',
    facilityType: '행정복지센터',
    lastUpdated: '2026-08-14T08:30:00',
    items: [
      { id: 'i06-01', name: '즉석밥', emoji: '🍚', category: 'food', stockStatus: 'many' },
      { id: 'i06-02', name: '라면', emoji: '🍜', category: 'food', stockStatus: 'normal' },
      { id: 'i06-03', name: '분유', emoji: '🍼', category: 'food', stockStatus: 'many' },
      { id: 'i06-04', name: '생활용품', emoji: '🧹', category: 'household', stockStatus: 'normal' },
      { id: 'i06-05', name: '마스크', emoji: '😷', category: 'hygiene', stockStatus: 'many' },
    ],
  },

  // ── 병점구 ──
  {
    id: 'site-hwaseong-byeongjeom-01',
    name: '병점1동행정복지센터',
    address: '경기도 화성시 병점구 경기대로1010번길 11',
    lat: 37.2068689831435,
    lng: 127.037279168976,
    phone: '031-369-5940',
    operatingHours: '09:00 ~ 18:00',
    operatingDays: '평일',
    overallStatus: 'good',
    facilityType: '행정복지센터',
    lastUpdated: '2026-08-14T09:00:00',
    items: [
      { id: 'i07-01', name: '즉석밥', emoji: '🍚', category: 'food', stockStatus: 'many' },
      { id: 'i07-02', name: '통조림', emoji: '🥫', category: 'food', stockStatus: 'normal' },
      { id: 'i07-03', name: '생활용품', emoji: '🧹', category: 'household', stockStatus: 'normal' },
      { id: 'i07-04', name: '세제', emoji: '🧼', category: 'household', stockStatus: 'many' },
    ],
  },

  // ── 만세구 ──
  {
    id: 'site-national-manse-01',
    name: '화성시행복나눔푸드마켓',
    address: '경기도 화성시 만세구 향남읍 행정서로3길 50',
    lat: 37.1304896667031,
    lng: 126.919422651904,
    phone: '031-8059-1677',
    operatingHours: '09:00 ~ 18:00',
    operatingDays: '평일',
    overallStatus: 'fair',
    facilityType: '푸드뱅크',
    lastUpdated: '2026-08-14T08:45:00',
    items: [
      { id: 'i08-01', name: '즉석밥', emoji: '🍚', category: 'food', stockStatus: 'normal' },
      { id: 'i08-02', name: '쌀 (10kg)', emoji: '🌾', category: 'food', stockStatus: 'many' },
      { id: 'i08-03', name: '라면', emoji: '🍜', category: 'food', stockStatus: 'normal' },
      { id: 'i08-04', name: '생활용품', emoji: '🧹', category: 'household', stockStatus: 'normal' },
      { id: 'i08-05', name: '화장지', emoji: '🧻', category: 'household', stockStatus: 'few' },
    ],
  },
  {
    id: 'site-hwaseong-manse-01',
    name: '우정읍행정복지센터',
    address: '경기도 화성시 만세구 우정읍 쌍봉로 109-14',
    lat: 37.0897836831861,
    lng: 126.815384166462,
    phone: '031-369-5870',
    operatingHours: '09:00 ~ 18:00',
    operatingDays: '평일',
    overallStatus: 'fair',
    facilityType: '행정복지센터',
    lastUpdated: '2026-08-14T09:05:00',
    items: [
      { id: 'i09-01', name: '즉석밥', emoji: '🍚', category: 'food', stockStatus: 'normal' },
      { id: 'i09-02', name: '라면', emoji: '🍜', category: 'food', stockStatus: 'normal' },
      { id: 'i09-03', name: '통조림', emoji: '🥫', category: 'food', stockStatus: 'few' },
      { id: 'i09-04', name: '생활용품', emoji: '🧹', category: 'household', stockStatus: 'normal' },
    ],
  },
  {
    id: 'site-hwaseong-manse-02',
    name: '남양읍행정복지센터',
    address: '경기도 화성시 만세구 남양읍 화성시청역로 36',
    lat: 37.1930200605643,
    lng: 126.821318754722,
    phone: '031-369-5880',
    operatingHours: '09:00 ~ 18:00',
    operatingDays: '평일',
    overallStatus: 'low',
    facilityType: '행정복지센터',
    lastUpdated: '2026-08-13T17:00:00',
    items: [
      { id: 'i10-01', name: '즉석밥', emoji: '🍚', category: 'food', stockStatus: 'few' },
      { id: 'i10-02', name: '라면', emoji: '🍜', category: 'food', stockStatus: 'few' },
      { id: 'i10-03', name: '생필품', emoji: '📦', category: 'other', stockStatus: 'normal' },
    ],
  },
  {
    id: 'site-hwaseong-manse-03',
    name: '새솔동행정복지센터',
    address: '경기도 화성시 만세구 수노을중앙로 178',
    lat: 37.2812570589778,
    lng: 126.818708668473,
    phone: '031-369-5890',
    operatingHours: '09:00 ~ 18:00',
    operatingDays: '평일',
    overallStatus: 'fair',
    facilityType: '행정복지센터',
    lastUpdated: '2026-08-14T09:20:00',
    items: [
      { id: 'i11-01', name: '즉석밥', emoji: '🍚', category: 'food', stockStatus: 'normal' },
      { id: 'i11-02', name: '라면', emoji: '🍜', category: 'food', stockStatus: 'many' },
      { id: 'i11-03', name: '위생용품', emoji: '🧴', category: 'hygiene', stockStatus: 'few' },
      { id: 'i11-04', name: '마스크', emoji: '😷', category: 'hygiene', stockStatus: 'normal' },
    ],
  },
];

export function getSiteById(id: string): CitizenSite | null {
  return citizenSites.find((s) => s.id === id) ?? null;
}

/** 물품명(부분 일치)으로 해당 물품이 있는 지점 목록 반환 */
export function searchSitesByItem(query: string): Array<{
  site: CitizenSite;
  matchedItems: CitizenItem[];
}> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return citizenSites
    .map((site) => ({
      site,
      matchedItems: site.items.filter(
        (item) => item.name.toLowerCase().includes(q) && item.stockStatus !== 'none',
      ),
    }))
    .filter((r) => r.matchedItems.length > 0);
}

/** 카테고리로 해당 물품이 있는 지점 목록 반환 */
export function searchSitesByCategory(category: ItemCategory): Array<{
  site: CitizenSite;
  matchedItems: CitizenItem[];
}> {
  return citizenSites
    .map((site) => ({
      site,
      matchedItems: site.items.filter(
        (item) => item.category === category && item.stockStatus !== 'none',
      ),
    }))
    .filter((r) => r.matchedItems.length > 0);
}
