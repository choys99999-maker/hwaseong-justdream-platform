import type { DistrictId } from '../types';
import type { SiteQuickStatus, SiteAvailability } from '../store/citizenSites';
import { buildCitizenSites } from '../utils/citizenSite';
import { siteAreaOf } from './mockSites';
import { citizenSites as legacyDetail, type CitizenSite as LegacyDetail } from './citizenData';

/**
 * 시민 화면이 쓰는 단 하나의 거점 목록.
 *
 * 왜 이 파일이 필요한가 —
 * 지금까지 시민 화면은 서로 다른 두 데이터를 동시에 쓰고 있었다.
 *   · `mockSites`(justdream-01~25)  : 관리자와 공유하는 실제 거점. Supabase 현황이 덧씌워진다.
 *   · `citizenData`(site-*-*)       : 지도·물품찾기 전용으로 따로 만든 11곳. 물품 목록·운영시간을 갖는다.
 * ID 체계가 달라서 지도 시트의 "상세보기"(`/site/site-national-...`)가 25곳 목록에서 조회에
 * 실패했고, 사용자에게는 "거점 정보를 찾을 수 없어요" 만 떴다.
 *
 * 그래서 두 데이터를 한 ID 공간으로 합친다.
 *   · 주소가 같은 6곳은 justdream 쪽 ID 로 병합하고, 물품·운영시간만 얹는다.
 *   · 25곳에 없는 푸드뱅크·푸드마켓 5곳은 원래 ID 그대로 목록에 남긴다(거점을 잃지 않는다).
 * 결과적으로 지도·추천·상세·물품찾기가 전부 같은 목록과 같은 ID 를 본다.
 */

/**
 * 주소가 정확히 일치해 같은 장소로 확인된 짝. (citizenData id → justdream id)
 * 예: 봉담읍행정복지센터 = 봉담읍지역사회보장협의체 (효행구 봉담읍 샘마을1길 7)
 */
const MERGE_INTO: Record<string, string> = {
  'site-hwaseong-hyohaeng-01': 'justdream-13', // 봉담읍 샘마을1길 7
  'site-hwaseong-byeongjeom-01': 'justdream-19', // 병점구 경기대로1010번길 11
  'site-hwaseong-dongtan-01': 'justdream-25', // 동탄구 동탄신리천로9길 76
  'site-hwaseong-manse-01': 'justdream-10', // 만세구 우정읍 쌍봉로 109-14
  'site-hwaseong-manse-02': 'justdream-12', // 만세구 남양읍 화성시청역로 36
  'site-hwaseong-manse-03': 'justdream-17', // 만세구 수노을중앙로 178
};

/** 25곳 목록에 없어 독립 거점으로 남기는 푸드뱅크·푸드마켓의 소속 구. */
const STANDALONE_DISTRICT: Record<string, DistrictId> = {
  'site-national-hyohaeng-01': 'hyohaeng',
  'site-national-hyohaeng-02': 'hyohaeng',
  'site-national-dongtan-01': 'dongtan',
  'site-national-dongtan-02': 'dongtan',
  'site-national-manse-01': 'manse',
};

/** 물품 한 줄. 시민에게는 "많다/적다" 두 단계면 충분해서 3단계까지만 쓴다. */
export type StockLevel = 'many' | 'some' | 'few';

export interface PlaceItem {
  id: string;
  name: string;
  category: ItemGroup;
  level: StockLevel;
}

/**
 * 물품 분류. 실제 데이터에 존재하는 세 가지만 둔다 —
 * 화면에 있는데 결과가 0건인 분류(의류 등)는 사용자에게 "없는 서비스" 로 읽히므로 만들지 않는다.
 */
export type ItemGroup = 'food' | 'living' | 'hygiene';

export const ITEM_GROUP_LABEL: Record<ItemGroup, string> = {
  food: '먹거리',
  living: '생활용품',
  hygiene: '위생용품',
};

export const ITEM_GROUP_ORDER: ItemGroup[] = ['food', 'living', 'hygiene'];

export interface CitizenPlace {
  id: string;
  /** 공식 기관명. 길찾기 딥링크와 검색에 쓴다. */
  name: string;
  /** 화면에 쓰는 짧은 이름. */
  displayName: string;
  facilityType: string;
  address: string | null;
  phone: string | null;
  lat: number;
  lng: number;
  district: DistrictId;
  availability: SiteAvailability;
  /** 담당자가 지정한 대표 품목 한 줄. 상세 물품 목록이 없을 때 이걸 보여준다. */
  focusItem: string | null;
  /** 지금 확인된 물품. 없으면 빈 배열이며, 없다고 지어내지 않는다. */
  items: PlaceItem[];
  /** '평일' 등. 확인된 자료가 없으면 null 이고 화면에서 운영 상태를 주장하지 않는다. */
  openDays: string | null;
  /** '09:00 ~ 18:00'. 위와 같다. */
  openHours: string | null;
  updatedAt: string;
  hasLiveStatus: boolean;
}

const LEGACY_LEVEL: Record<string, StockLevel | null> = {
  many: 'many',
  normal: 'some',
  few: 'few',
  none: null,
};

const LEGACY_GROUP: Record<string, ItemGroup> = {
  food: 'food',
  household: 'living',
  hygiene: 'hygiene',
  clothing: 'living',
  other: 'living',
};

function toItems(detail: LegacyDetail): PlaceItem[] {
  return detail.items.flatMap((item) => {
    const level = LEGACY_LEVEL[item.stockStatus] ?? null;
    if (!level) return [];
    return [
      {
        id: item.id,
        name: item.name,
        category: LEGACY_GROUP[item.category] ?? 'living',
        level,
      },
    ];
  });
}

/** citizenData 의 거점 단위 상태를 시민 3단계로 접는다. 새 판정을 만들지 않는다. */
function toAvailability(detail: LegacyDetail): SiteAvailability {
  if (detail.overallStatus === 'good' || detail.overallStatus === 'fair') return 'available';
  if (detail.overallStatus === 'low') return 'low';
  return 'unknown';
}

/**
 * v_inventory_status 에서 온 실 재고 데이터. organizationName → 품목 목록 + 갱신 시각.
 * category 열이 DB 스키마에 없어 품목명에서 추론한 값이 들어온다.
 */
export interface LiveInventoryData {
  items: PlaceItem[];
  updatedAt: string | null;
}

/**
 * 시민 거점 전체 목록.
 * `overrides` 는 현장 담당자가 남긴 최신 상태(site_quick_status). 비어 있으면 시연 기본값을 쓴다.
 * `liveInventory` 는 v_inventory_status 의 실 재고. 중앙 저장소가 켜져 있을 때만 전달된다.
 */
export function buildCitizenPlaces(
  overrides: Map<string, SiteQuickStatus>,
  liveInventory?: Map<string, LiveInventoryData>,
): CitizenPlace[] {
  const detailById = new Map(legacyDetail.map((d) => [d.id, d]));

  /** justdream id → 병합해 올릴 상세 정보 */
  const mergedDetail = new Map<string, LegacyDetail>();
  for (const [legacyId, justdreamId] of Object.entries(MERGE_INTO)) {
    const detail = detailById.get(legacyId);
    if (detail) mergedDetail.set(justdreamId, detail);
  }

  const primary: CitizenPlace[] = buildCitizenSites(overrides).map((site) => {
    const detail = mergedDetail.get(site.id);
    const area = siteAreaOf(site.id);
    const live = area ? liveInventory?.get(area) : undefined;
    return {
      id: site.id,
      name: site.name,
      displayName: site.displayName,
      facilityType: detail?.facilityType ?? facilityTypeOf(site.name),
      address: site.address ?? detail?.address ?? null,
      // 거점 전화번호는 justdream 자료에 없다 — 병합된 곳에서만 확인된 번호가 생긴다.
      phone: site.phone ?? detail?.phone ?? null,
      lat: site.lat,
      lng: site.lng,
      district: site.district,
      availability: site.availability,
      focusItem: site.focusItem,
      // citizenData 상세 데이터가 없는 거점은 v_inventory_status 실 재고로 채운다.
      items: detail ? toItems(detail) : (live?.items ?? []),
      openDays: detail?.operatingDays ?? null,
      openHours: detail?.operatingHours ?? null,
      // 현장 담당자 동기화가 없고 실 재고가 있으면 재고 제출 시각을 갱신 기준으로 쓴다.
      updatedAt: (!site.hasLiveStatus && live?.updatedAt) ? live.updatedAt : site.updatedAt,
      hasLiveStatus: site.hasLiveStatus,
    };
  });

  const standalone: CitizenPlace[] = legacyDetail
    .filter((d) => !(d.id in MERGE_INTO))
    .map((d) => ({
      id: d.id,
      name: d.name,
      displayName: d.name,
      facilityType: d.facilityType,
      address: d.address,
      phone: d.phone,
      lat: d.lat,
      lng: d.lng,
      district: STANDALONE_DISTRICT[d.id] ?? 'manse',
      availability: toAvailability(d),
      focusItem: null,
      items: toItems(d),
      openDays: d.operatingDays,
      openHours: d.operatingHours,
      updatedAt: d.lastUpdated,
      hasLiveStatus: false,
    }));

  return [...primary, ...standalone];
}

/** 기관명에서 읽어낼 수 있는 시설 유형만 쓴다. 모르면 '그냥드림 거점' 으로 둔다. */
function facilityTypeOf(name: string): string {
  if (name.includes('지역사회보장협의체')) return '행정복지센터';
  if (name.includes('복지관')) return '복지관';
  if (name.includes('푸드뱅크') || name.includes('푸드마켓')) return '푸드뱅크';
  return '그냥드림 거점';
}
