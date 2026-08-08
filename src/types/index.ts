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
  /** 정식 기관명. 상세 패널·표·데이터 매칭 기준값이다. */
  name: string;
  /** 지도 라벨용 축약 기관명. `src/data/siteDisplayName.ts` 규칙으로 생성한다. */
  displayName: string;
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
  /** 주소 */
  address?: string;
  /** 전화번호 (공식 확인된 경우) */
  phone?: string;
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

/** 복지서비스 연계완료 유형별 건수 */
export interface WelfareLinkageBreakdown {
  basicLivelihood: number;
  nearPoor: number;
  emergencyWelfare: number;
  other: number;
}

/** 기관별 실적 1건. 주별·누적 실적 화면에서 공통으로 사용한다. */
export interface OrgPerformanceRecord {
  id: string;
  orgName: string;
  regionId: RegionId;
  /** 주별 실적일 때만 사용하는 주차 라벨 (예: '2026-08-1주차') */
  weekLabel?: string;
  userCount: number;
  basicCounselingCount: number;
  counselingReferralCount: number;
  welfareLinkageCompleted: WelfareLinkageBreakdown;
  underReviewCount: number;
  noLinkageNeededCount: number;
}

export type VisitType = '최초방문' | '재방문';
export type LinkageConductedStatus = '실시' | '미실시';
export type LinkageCompletionType = '기초생활' | '차상위' | '긴급복지' | '기타' | '해당없음';

/** 2차 의뢰 연계 대상자 1명. */
export interface SecondReferralCase {
  id: string;
  orgName: string;
  regionId: RegionId;
  visitType: VisitType;
  clientName: string;
  birthDate: string;
  address: string;
  counselingDate: string;
  secondReferralDong: string;
  linkageConducted: LinkageConductedStatus;
  linkageCompletionType: LinkageCompletionType;
  note?: string;
  underReview: boolean;
  noLinkageNeeded: boolean;
}

/** 복지연계 최종 상태 */
export type LinkageStatus = '연계완료' | '검토중' | '연계불요' | '기타';

/** 연계상담 실시 여부 (서식 표기: O / X) */
export type LinkageConductedFlag = 'O' | 'X';

/** 이용자 1회 방문 기록 */
export interface CounselingVisit {
  visitNo: number;
  visitDate: string;
  visitType: VisitType;
  counselingNote?: string;
  linkageConducted: LinkageConductedFlag;
  linkageStatus?: LinkageStatus;
  linkageService?: string;
  secondReferralDong?: string;
}

/** 화성시 2차 연계 대상자 통합 관리 레코드 */
export interface CounselingRecord {
  id: string;
  seq: number;
  orgName: string;
  regionId: RegionId;
  visitType: VisitType;
  clientName: string;
  birthDate: string;
  address: string;
  counselingDate: string;
  secondReferralDong: string;
  linkageConducted: LinkageConductedFlag;
  linkageStatus: LinkageStatus;
  linkageService?: string;
  note?: string;
  history: CounselingVisit[];
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
  /** 서해 도서를 제외한 본토 중심 확대 범위. 폴리곤 데이터에는 도서가 그대로 남아 있다. */
  focusBBox: BoundaryBBox;
  /** 구 폴리곤 내부가 보장된 대표점 [lng, lat]. 클러스터 오버레이 위치로 쓴다. */
  center: [number, number];
  /** 읍면동 경계를 dissolve 한 구 외곽선. 링마다 폴리라인 1개로 그린다. */
  outline: BoundaryRing[];
  areas: DistrictBoundaryArea[];
}
