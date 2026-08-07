/** 화성특례시 4개 구. 경계 데이터(`src/data/geo`)의 `id` 와 동일하다. */
export type DistrictId = 'manse' | 'hyohaeng' | 'byeongjeom' | 'dongtan';

/** 사업 유형. 화성형(그냥드림) 또는 국가형 */
export type ProgramType = 'HWASEONG' | 'NATIONAL';

/** 기존 화면에서 쓰던 지역 식별자. 화성특례시 구 개편에 맞춰 4개 구와 동일하게 유지한다. */
export type RegionId = DistrictId;

export interface MonthlyTrendPoint {
  month: string;
  count: number;
}

export interface Region {
  id: RegionId;
  name: string;
  orgCount: number;
  userCount: number;
  monthlySupportCount: number;
  inventoryCount: number;
  expiringSoonCount: number;
  lastUpdated: string;
  monthlyTrend: MonthlyTrendPoint[];
}

export type CounselingStatus = '연계 완료' | '연계 진행중' | '미연계';

export interface SupportRecord {
  id: string;
  userName: string;
  regionId: RegionId;
  regionName: string;
  supportDate: string;
  item: string;
  quantity: number;
  counselingStatus: CounselingStatus;
}

export type InventoryStatus = '정상' | '임박' | '부족' | '확인 필요';

export interface InventoryItem {
  id: string;
  name: string;
  regionId: RegionId;
  regionName: string;
  inboundQuantity: number;
  outboundQuantity: number;
  currentStock: number;
  expiryDate: string;
  status: InventoryStatus;
}

export type DataIssueSeverity = '높음' | '중간' | '낮음';

export interface DataIssueAlert {
  id: string;
  title: string;
  description: string;
  regionName?: string;
  severity: DataIssueSeverity;
}

/** 거점·구역 운영 상태. 지도 폴리곤과 거점 마커 색상 기준이 된다. */
export type SiteStatus = 'normal' | 'shortage' | 'expiring' | 'surplus' | 'missing';

export type FacilityType = '행정복지센터' | '복지관' | '푸드뱅크' | '기타';

export interface OperationSite {
  id: string;
  name: string;
  district: DistrictId;
  facilityType: FacilityType;
  latitude: number;
  longitude: number;
  status: SiteStatus;
  /** 현재 보유 재고 수량(개) */
  inventoryCount: number;
  /** 7일 예상 수요(개) */
  sevenDayDemand: number;
  /** 예상 부족 수량(개). `sevenDayDemand - inventoryCount` 로 계산한다. */
  expectedShortage: number;
  /** 유통기한 임박 수량(개) */
  expiringCount: number;
  lastUpdatedAt: string;
  /** 재배분 판단 기준이 되는 주요 품목 */
  focusItem: string;
  /** 합성 데모 데이터 여부 */
  isDemo: boolean;
  /** 이 장소에서 운영하는 사업 유형 목록. 동시 운영이면 두 값 모두 포함된다. */
  programTypes: ProgramType[];
  /** 주소 (합성 데이터) */
  address?: string;
}

export interface OperationSummary {
  siteCount: number;
  inventoryTotal: number;
  sevenDayDemandTotal: number;
  shortageSiteCount: number;
  shortageQuantity: number;
  expiringQuantity: number;
  surplusSiteCount: number;
  missingSiteCount: number;
  recommendationCount: number;
}

export interface DistrictSummary extends OperationSummary {
  id: DistrictId;
  name: string;
  riskLevel: SiteStatus;
}

export interface RedistributionRecommendation {
  id: string;
  priority: number;
  item: string;
  district: DistrictId;
  fromSiteId: string;
  fromSiteName: string;
  toSiteId: string;
  toSiteName: string;
  shortageQuantity: number;
  moveQuantity: number;
}

export interface RedistributionRecord {
  id: string;
  date: string;
  item: string;
  quantity: number;
  fromSiteName: string;
  toSiteName: string;
  districtName: string;
}

/** GeoJSON 링: `[경도, 위도]` 좌표 배열 */
export type BoundaryRing = [number, number][];
/** 폴리곤 1개: 첫 링이 외곽선, 이후 링은 구멍 */
export type BoundaryPolygon = BoundaryRing[];
export type BoundaryBBox = [number, number, number, number];

export interface DistrictBoundaryArea {
  name: string;
  code: string;
  polygons: BoundaryPolygon[];
}

export interface DistrictBoundary {
  id: DistrictId;
  name: string;
  bbox: BoundaryBBox;
  areas: DistrictBoundaryArea[];
}
