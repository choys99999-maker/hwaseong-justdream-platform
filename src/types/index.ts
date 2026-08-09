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

export type ItemCategory = '식품' | '위생용품' | '생필품' | '영유아용품' | '기타';

export interface InventoryItem {
  id: string;
  name: string;
  category: ItemCategory;
  regionId: RegionId;
  regionName: string;
  baseStock: number;
  inboundQuantity: number;
  outboundQuantity: number;
  discardQuantity: number;
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

// ─────────────────────────────────────────────────────────────────────────────
// 원본 서식 시드 전용 타입 (`src/data/mockCounselingRecords.ts`)
//
// 화성시 "2차 연계 대상자" 엑셀 서식을 그대로 옮긴 형태다. 런타임 도메인 모델은
// 아래의 Client / Visit / WelfareReferral 이며, 시드는 `mockClientRecords.ts` 가
// 한 번 변환해서 쓴다. 새 코드에서 이 타입들을 직접 참조하지 않는다.
// ─────────────────────────────────────────────────────────────────────────────

/** (시드 전용) 복지연계 최종 상태 */
export type LinkageStatus = '연계완료' | '검토중' | '연계불요' | '기타';

/** (시드 전용) 연계상담 실시 여부. 서식 표기(O/X)를 그대로 옮긴 값이다. */
export type LinkageConductedFlag = 'O' | 'X';

/** (시드 전용) 이용자 1회 방문 기록 */
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

/** (시드 전용) 화성시 2차 연계 대상자 통합 관리 레코드 */
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

// ─────────────────────────────────────────────────────────────────────────────
// 이용·상담 관리 도메인 모델
//
// 현행 그냥드림 운영 흐름을 그대로 따른다.
//   1차: 본인확인 → 자가 체크리스트 → 담당자 지원 판단 → 물품지원
//   2차: 재방문 확인 → 기본상담 → 물품지원 → 추가지원 필요 판단 → 읍면동 연계
//   3차+: 읍면동 추가상담 완료 확인 → 지속지원 필요성 판정 → 지속 물품지원
//
// Client 1 : N Visit 1 : 0..1 WelfareReferral
// ─────────────────────────────────────────────────────────────────────────────

/** 방문 차수. `visitNo` 에서 파생하며 따로 저장하지 않는다. */
export type VisitStage = '1차' | '2차' | '3차+';

/** 담당자 지원 판단 */
export type SupportDecision = '지원' | '미지원' | '보류';

/** 복지연계 진행 상태 */
export type ReferralStatus = '미연계' | '연계요청' | '읍면동상담중' | '연계완료' | '연계불요';

/** 지속지원 필요성 판정 (3차 이용) */
export type ContinuedSupport = '가능' | '불가' | '미판정';

/** 이용자 1명. 방문 이력과 분리해서 관리한다. */
export interface Client {
  id: string;
  /** 목록·인쇄에 나가는 마스킹 이름 (예: 홍○동) */
  nameMasked: string;
  /** 목록에는 출생연도까지만 노출한다. */
  birthYear: number;
  /** 전체 생년월일. 상세 화면에서만 쓴다. */
  birthDate?: string;
  /** 목록에는 거주 읍면동까지만 노출한다. */
  residenceDong: string;
  /** 상세주소. 상세 화면에서만 쓴다. */
  addressDetail?: string;
  regionId: RegionId;
  firstVisitDate: string;
  lastVisitDate: string;
  /** 방문 횟수. 반복방문 감지 기준값이며 방문 추가 시 갱신한다. */
  visitCount: number;
}

/**
 * 1회 방문에서 지원한 물품 1줄.
 *
 * `itemId` 는 품목 고유 식별자, `itemName` 은 화면 표시명이다. 둘을 같은 값으로
 * 쓰지 않는다. 재고·출고 연동은 integration 단계에서 `outboundRecordId` 로 잇는다.
 */
export interface SupportItem {
  itemId: string;
  itemName: string;
  quantity: number;
  unit?: string;
  /** 재고 브랜치의 출고 레코드와 연결되면 채워진다. 이 브랜치에서는 항상 비어 있다. */
  outboundRecordId?: string;
}

/** 기본상담. 복지연계와 분리된 별개 단계다. */
export interface BasicCounseling {
  conducted: boolean;
  note?: string;
  /** 추가지원 필요 판단. true 면 읍면동 복지연계로 넘어간다. */
  needsAdditionalSupport: boolean;
}

/** 방문 1회 = 흐름의 1차 / 2차 / 3차+ 한 단계 */
export interface Visit {
  id: string;
  clientId: string;
  /** 1부터 자동 누적된다. */
  visitNo: number;
  /** `visitNo` 에서 파생한 표시값 */
  visitStage: VisitStage;
  visitDate: string;
  /** 그냥드림 사업장 25개소 id (`justdream_sites_25.ts`) */
  siteId: string;
  orgName: string;
  identityVerified: boolean;
  /** 자가 체크리스트 완료 여부. 공식 문항이 확정되면 여기에 문항 배열을 덧붙인다. */
  checklistCompleted: boolean;
  supportDecision: SupportDecision;
  supportItems: SupportItem[];
  /** 1차에는 없을 수 있다. 2차부터 입력한다. */
  basicCounseling?: BasicCounseling;
  /** 이 방문에서 복지연계가 시작되면 채워진다. */
  referralId?: string;
}

/** 읍면동 맞춤형복지팀 연계 1건. 이용자당 최대 1건을 진행 상태로 관리한다. */
export interface WelfareReferral {
  id: string;
  clientId: string;
  /** 연계가 시작된 방문 */
  originVisitId: string;
  status: ReferralStatus;
  /** 연계한 읍면동. 화면 라벨은 화성시 서식대로 '2차 연계처(읍면동)' 를 쓴다. */
  linkedDong: string;
  linkedTeam?: string;
  requestedAt?: string;
  /** 읍면동 추가상담 완료일. 3차 이용의 전제 조건이다. */
  dongCounselingDoneAt?: string;
  linkageType?: LinkageCompletionType;
  linkageService?: string;
  continuedSupport: ContinuedSupport;
  resultNote?: string;
  updatedAt: string;
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
