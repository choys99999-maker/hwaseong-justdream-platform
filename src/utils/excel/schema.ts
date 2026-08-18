// 엑셀 해석 엔진 v2 — 표준 컬럼 정의.
//
// 표준 필드는 우리가 새로 정하는 게 아니라 이미 DB(create_submission RPC)가 받는
// camelCase 키다. 여기서 늘리는 것은 "같은 뜻의 다른 표현"(alias)뿐이다.
// 필드를 새로 만들면 RPC가 조용히 버리므로 절대 늘리지 않는다.
//   supabase/migrations/20260808010000_phase2_aggregation.sql 의 create_submission 참고.
import type { PlatformColumnDef, PlatformColumnKey, SheetType } from '../../types/upload';

/** 주별/누계 실적 보고 */
export const PERFORMANCE_COLUMNS: PlatformColumnDef[] = [
  {
    key: 'institution',
    label: '구분 (기관명)',
    required: true,
    aliases: ['구분', '기관명', '기관', '거점', '거점명', '센터', '센터명', '운영기관', '수행기관', '읍면동', '행정동', '동명'],
  },
  {
    key: 'userCount',
    label: '이용자',
    required: false,
    aliases: ['이용자수', '이용인원', '이용자현황', '이용건수', '이용자 수', '방문자수', '이용실적'],
  },
  {
    key: 'basicConsultation',
    label: '기본 상담 (2차 이용)',
    required: false,
    aliases: ['기본상담', '2차이용', '이차이용', '기본상담건수', '상담건수', '기본상담수'],
  },
  {
    key: 'referralTotal',
    label: '상담 연계 의뢰 (D)',
    required: false,
    aliases: ['상담연계의뢰', '상담연계', '연계의뢰', '의뢰', '의뢰건수', '연계의뢰건수', '연계의뢰수'],
  },
  {
    key: 'linkageCompleted',
    label: '연계완료 계(A)',
    required: false,
    aliases: ['연계완료', '연계완료계', '연계완료합계', '완료', '계'],
  },
  { key: 'basicLivelihood', label: '기초생활', required: false, aliases: ['기초생활수급', '기초수급', '기초생활보장'] },
  { key: 'nearPoverty', label: '차상위', required: false, aliases: ['차상위계층'] },
  { key: 'emergencyWelfare', label: '긴급복지', required: false, aliases: ['긴급지원', '긴급복지지원'] },
  { key: 'otherLinkage', label: '기타', required: false, aliases: ['기타연계', '그밖에'] },
  { key: 'underReview', label: '검토중 (B)', required: false, aliases: ['검토중', '검토', '검토중인건'] },
  { key: 'noLinkageNeeded', label: '연계불요 (C)', required: false, aliases: ['연계불요', '불요', '연계불필요', '해당없음'] },
];

/** 2차 의뢰 연계 (개인정보 포함) */
export const REFERRAL_COLUMNS: PlatformColumnDef[] = [
  { key: 'serialNo', label: '연번', required: false, aliases: ['번호', '순번', 'no', '일련번호'] },
  { key: 'institution', label: '기관명', required: false, aliases: ['기관', '거점명', '거점', '접수기관', '의뢰기관'] },
  { key: 'visitType', label: '방문구분', required: false, aliases: ['방문유형', '상담구분', '방문형태', '내방구분'] },
  {
    key: 'clientName',
    label: '대상자 이름',
    required: true,
    aliases: ['이름', '성명', '대상자', '대상자명', '대상자이름', '성함', '신청인'],
  },
  { key: 'birthDate', label: '생년월일', required: false, aliases: ['생년', '생일', '출생년월일', '생년월일자'] },
  { key: 'address', label: '주소', required: false, aliases: ['거주지', '주소지', '현주소', '거주지주소'] },
  {
    key: 'consultDate',
    label: '상담(방문)일자',
    required: false,
    aliases: ['상담일자', '상담방문일자', '방문일자', '상담일', '방문일', '상담날짜', '접수일자', '접수일'],
  },
  {
    key: 'referralTarget',
    label: '2차 연계처(읍면동)',
    required: false,
    aliases: ['연계처', '2차연계처', '이차연계처', '읍면동', '연계기관', '의뢰처', '연계대상기관'],
  },
  {
    key: 'consultationDone',
    label: '연계 상담 실시 여부',
    required: false,
    aliases: ['연계상담실시여부', '연계상담실시', '실시여부', '상담실시', '연계상담'],
  },
  { key: 'linkageType', label: '연계완료', required: false, aliases: ['연계유형', '연계결과', '연계내용', '연계완료유형'] },
  { key: 'serviceDetails', label: '기타 내역', required: false, aliases: ['기타내역', '세부내역', '지원내역', '비고내역', '특이내역'] },
  { key: 'underReview', label: '검토중', required: false, aliases: ['검토'] },
  { key: 'noLinkageNeeded', label: '연계불요', required: false, aliases: ['불요', '연계불필요'] },
];

/** 일반 물품 배분 / 재고 */
export const GENERIC_COLUMNS: PlatformColumnDef[] = [
  {
    key: 'region',
    label: '지역',
    required: false,
    aliases: ['권역', '읍면동', '행정동', '관할지역', '소재지역', '지역명', '동명', '지역구분'],
  },
  {
    key: 'organization',
    label: '기관명',
    required: false,
    aliases: ['기관', '단체명', '거점', '거점명', '운영기관', '배부처', '수행기관', '센터명', '매장명', '나눔가게', '제공처', '제출기관', '제출 기관'],
  },
  {
    key: 'itemName',
    label: '품목명',
    required: true,
    aliases: ['품목', '물품', '물품명', '상품명', '제품명', '품명', '식품명', '물품종류', '품목종류', '지원품목'],
  },
  {
    key: 'inboundQuantity',
    label: '입고수량',
    required: false,
    aliases: ['입고', '입고량', '입고 수량', '입고개수', '입고건수', '반입량', '반입수량', '기부량', '기부수량', '후원수량', '후원량', '수급량', '들어온수량'],
  },
  {
    key: 'outboundQuantity',
    label: '출고수량',
    required: false,
    aliases: ['출고', '출고량', '출고 수량', '배부량', '배부수량', '지원수량', '지원량', '제공수량', '제공량', '나눔수량', '불출량', '불출수량', '반출량', '사용량'],
  },
  {
    key: 'stock',
    label: '현재재고',
    required: false,
    aliases: ['재고', '재고량', '현재고', '잔량', '잔여수량', '재고수량', '보유수량', '남은수량', '기말재고', '현재재고량', '수량'],
  },
  {
    key: 'inboundDate',
    label: '입고일',
    required: false,
    aliases: ['입고일자', '입고날짜', '반입일', '반입일자', '기부일', '후원일', '등록일', '접수일', '기준일'],
  },
  {
    key: 'expirationDate',
    label: '유통기한',
    required: false,
    aliases: ['소비기한', '유효기간', '기한', '만료일', '유통기한일', '소비기한일', '폐기예정일', '만료일자'],
  },
];

// 하위 호환 (기존 import 유지)
export const PLATFORM_COLUMNS = GENERIC_COLUMNS;

export function getColumnsForType(type: SheetType): PlatformColumnDef[] {
  if (type === 'performance') return PERFORMANCE_COLUMNS;
  if (type === 'referral') return REFERRAL_COLUMNS;
  return GENERIC_COLUMNS;
}

export const SHEET_TYPES: SheetType[] = ['performance', 'referral', 'generic'];

/**
 * 저장 대상이 아닌 것이 분명한 열.
 * "인식 못 했다"가 아니라 "저장하지 않기로 정한 열"이므로 화면에 사유와 함께 보여준다.
 * (조용히 버리지 않는다 — 미인식과 구분해서 표시할 뿐이다)
 */
export const IGNORED_COLUMNS: Array<{ keys: string[]; reason: string }> = [
  { keys: ['비고', '특이사항', '참고', '참고사항', '메모', '기타사항'], reason: '자유 기재 칸이라 저장하지 않습니다' },
  { keys: ['작성자', '담당자', '작성일', '작성일자', '확인자', '결재'], reason: '작성 관리용 칸이라 저장하지 않습니다' },
  { keys: ['합계', '총계', '소계', '누계', '총합', '계정'], reason: '집계 칸이라 저장하지 않습니다 (플랫폼이 다시 계산합니다)' },
  { keys: ['연락처', '전화번호', '휴대폰', '휴대전화', '전화'], reason: '개인정보라 저장하지 않습니다' },
  { keys: ['단위'], reason: '단위 표기 칸이라 저장하지 않습니다' },
];

/** 값 유형 — 시트 유형마다 같은 키라도 숫자/문자가 다를 수 있어 유형별로 갖는다. */
export const NUMBER_FIELDS: Record<SheetType, Set<PlatformColumnKey>> = {
  performance: new Set<PlatformColumnKey>([
    'userCount', 'basicConsultation', 'referralTotal', 'linkageCompleted',
    'basicLivelihood', 'nearPoverty', 'emergencyWelfare', 'otherLinkage',
    'underReview', 'noLinkageNeeded',
  ]),
  referral: new Set<PlatformColumnKey>(['serialNo']),
  generic: new Set<PlatformColumnKey>(['inboundQuantity', 'outboundQuantity', 'stock']),
};

export const DATE_FIELDS = new Set<PlatformColumnKey>(['consultDate', 'inboundDate', 'expirationDate']);

/** 음수가 있을 수 없는 값. */
export const NON_NEGATIVE_FIELDS = new Set<PlatformColumnKey>([
  'stock', 'inboundQuantity', 'outboundQuantity', 'userCount', 'basicConsultation',
  'referralTotal', 'linkageCompleted', 'basicLivelihood', 'nearPoverty',
  'emergencyWelfare', 'otherLinkage', 'underReview', 'noLinkageNeeded',
]);

/** 화면 문구용 짧은 이름. */
export const FIELD_LABELS: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const def of [...PERFORMANCE_COLUMNS, ...REFERRAL_COLUMNS, ...GENERIC_COLUMNS]) {
    if (!map[def.key]) map[def.key] = def.label;
  }
  return map;
})();

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}
