import type { PlatformColumnDef, PlatformColumnKey, SheetType } from '../types/upload';

export const PERFORMANCE_COLUMNS: PlatformColumnDef[] = [
  { key: 'institution', label: '구분 (기관명)', required: true, aliases: ['구분', '기관명', '기관', '시설', '시설명', '거점', '거점명', '운영기관', '기관 구분'] },
  { key: 'userCount', label: '이용자', required: false, aliases: ['이용자 수', '이용자수', '이용인원', '이용 인원', '총이용인원', '총 이용인원', '이용건수', '방문자수', '방문 인원'] },
  { key: 'basicConsultation', label: '기본 상담 (2차 이용)', required: false, aliases: ['기본 상담', '기본상담', '(2차 이용)', '2차 이용', '2차이용', '2차 상담', '2차상담'] },
  { key: 'referralTotal', label: '상담 연계 의뢰 (D)', required: false, aliases: ['상담 연계', '상담연계', '의뢰', '(D)', '연계 의뢰', '연계의뢰', '의뢰건수', '의뢰 건수', '상담 연계 의뢰'] },
  { key: 'linkageCompleted', label: '연계완료 계(A)', required: false, aliases: ['연계완료', '연계 완료', '계(A)', '계', '완료건수', '완료 건수', '연계완료 계'] },
  { key: 'basicLivelihood', label: '기초생활', required: false, aliases: ['기초 생활', '기초생활수급', '기초생활 수급', '수급'] },
  { key: 'nearPoverty', label: '차상위', required: false, aliases: ['차상위계층', '차상위 계층'] },
  { key: 'emergencyWelfare', label: '긴급복지', required: false, aliases: ['긴급 복지', '긴급지원', '긴급 지원'] },
  { key: 'otherLinkage', label: '기타', required: false, aliases: ['기타연계', '기타 연계', '그 외', '그외'] },
  { key: 'underReview', label: '검토중 (B)', required: false, aliases: ['검토중', '검토 중', '(B)', '검토'] },
  { key: 'noLinkageNeeded', label: '연계불요 (C)', required: false, aliases: ['연계불요', '연계 불요', '(C)', '불요'] },
];

export const REFERRAL_COLUMNS: PlatformColumnDef[] = [
  { key: 'serialNo', label: '연번', required: false, aliases: ['번호', '순번', 'no'] },
  { key: 'institution', label: '기관명', required: false, aliases: ['기관', '시설명', '거점명', '운영기관'] },
  { key: 'visitType', label: '방문구분', required: false, aliases: ['방문 구분', '구분', '신규/재방문'] },
  { key: 'clientName', label: '대상자 이름', required: true, aliases: ['이름', '성명', '대상자', '대상자이름', '대상자 성명', '이용자명', '이용자 이름'] },
  // '생년'(출생 연도)은 일부러 뺐다. 연도만 적힌 칸을 생년월일로 읽으면
  // 네 자리 숫자가 엉뚱한 날짜로 바뀐다. 연결하지 않고 남겨두는 편이 안전하다.
  { key: 'birthDate', label: '생년월일', required: false, aliases: ['생년 월일', '생일'] },
  { key: 'address', label: '주소', required: false, aliases: ['거주지', '주소지'] },
  { key: 'consultDate', label: '상담(방문)일자', required: false, aliases: ['방문일자', '상담일', '상담일자', '상담 일자', '방문 일자', '방문일', '상담(방문)일'] },
  { key: 'referralTarget', label: '2차 연계처(읍면동)', required: false, aliases: ['연계처', '읍면동', '2차 연계처', '2차연계처', '연계 기관', '연계기관'] },
  { key: 'consultationDone', label: '연계 상담 실시 여부', required: false, aliases: ['실시 여부', '실시여부', '연계 상담', '연계상담', '상담 실시'] },
  { key: 'linkageType', label: '연계완료', required: false, aliases: ['연계 완료', '완료 유형', '연계유형', '연계 유형'] },
  { key: 'serviceDetails', label: '기타 내역', required: false, aliases: ['기타내역', '비고', '특이사항'] },
  { key: 'underReview', label: '검토중', required: false, aliases: ['검토 중', '검토'] },
  { key: 'noLinkageNeeded', label: '연계불요', required: false, aliases: ['연계 불요', '불요'] },
];

export const GENERIC_COLUMNS: PlatformColumnDef[] = [
  { key: 'region', label: '지역', required: false, aliases: ['읍면동', '권역', '행정동', '읍·면·동', '소재지'] },
  { key: 'organization', label: '기관명', required: false, aliases: ['기관', '시설명', '센터명', '거점명', '운영기관'] },
  { key: 'itemName', label: '품목명', required: true, aliases: ['품목', '물품명', '상품명', '품명', '물품', '지원품목', '지원 품목'] },
  { key: 'inboundQuantity', label: '입고수량', required: false, aliases: ['입고량', '입고', '입고 수량', '입고수', '반입', '반입량', '반입수량'] },
  { key: 'outboundQuantity', label: '출고수량', required: false, aliases: ['출고량', '출고', '출고 수량', '출고수', '반출', '반출량', '배부', '배부량', '배부수량', '지급', '지급량', '지급수량'] },
  { key: 'stock', label: '현재재고', required: false, aliases: ['재고', '재고량', '현재고', '잔량', '잔여', '잔여량', '보유', '보유량', '현재 재고', '기말재고'] },
  { key: 'inboundDate', label: '입고일', required: false, aliases: ['입고일자', '입고 일자', '입고날짜', '반입일', '반입일자'] },
  { key: 'expirationDate', label: '유통기한', required: false, aliases: ['소비기한', '유효기간', '기한', '유통 기한', '소비 기한'] },
];

// 하위 호환
export const PLATFORM_COLUMNS = GENERIC_COLUMNS;

export const SHEET_TYPES: SheetType[] = ['performance', 'referral', 'generic'];

/**
 * 유형별 "핵심 열 그룹". 각 그룹에서 최소 하나는 연결돼야 자료로 인정한다.
 * required(기관명/품목명/대상자) 하나만 맞아도 통과하던 문제를 막는다.
 * 예: 품목명만 있고 수량·재고가 하나도 없는 시트는 물품 자료로 볼 수 없다.
 */
export const CORE_COLUMN_GROUPS: Record<SheetType, PlatformColumnKey[][]> = {
  performance: [[
    'userCount', 'basicConsultation', 'referralTotal', 'linkageCompleted',
    'basicLivelihood', 'nearPoverty', 'emergencyWelfare', 'otherLinkage',
    'underReview', 'noLinkageNeeded',
  ]],
  referral: [['consultDate', 'referralTarget']],
  generic: [['inboundQuantity', 'outboundQuantity', 'stock']],
};

export function detectSheetTypeByName(sheetName: string): SheetType | null {
  const n = sheetName.trim();
  if (n.includes('주별 실적') || n.includes('실적 보고') || n.includes('누계')) return 'performance';
  if (n.includes('의뢰') || n.includes('연계') || n.includes('대상자')) return 'referral';
  return null;
}

/**
 * 시트 이름만 보는 판정. 헤더를 아직 못 읽었을 때의 마지막 수단이다.
 * 실제 판별은 detectSheetTypeByHeaders(=열 이름)가 우선한다.
 */
export function detectSheetType(sheetName: string): SheetType {
  return detectSheetTypeByName(sheetName) ?? 'generic';
}

/**
 * 누계 시트인지. 주별 실적과 누계 실적을 함께 더하면 같은 값을 두 번 세게 되므로
 * 집계에서 빼려면 이 판정이 필요하다. (DB의 create_submission도 같은 규칙을 갖고 있다)
 */
export function isCumulativeSheet(sheetName: string): boolean {
  return sheetName.includes('누계');
}

export function getColumnsForType(type: SheetType): PlatformColumnDef[] {
  if (type === 'performance') return PERFORMANCE_COLUMNS;
  if (type === 'referral') return REFERRAL_COLUMNS;
  return GENERIC_COLUMNS;
}

// ── 열 이름 정규화 ────────────────────────────────────────
// 실제 제출 파일은 같은 뜻을 공백·괄호·줄바꿈·기호로 제각각 쓴다.
// ('현재재고 (8/7 기준)', '입고\n수량', '기초 생활' …)
// 비교 전에 표기 흔들림을 걷어내고 뼈대만 남긴다.
export function normalizeColumnName(raw: string): string {
  return raw
    .replace(/\r?\n/g, ' ')
    .replace(/[()[\]{}（）]/g, ' ')
    .replace(/[·ㆍ・~/\\,.]/g, ' ')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

/** 부분일치를 허용할 최소 길이. 짧은 토큰('계','기타')이 아무데나 붙는 것을 막는다. */
const MIN_PARTIAL_LENGTH = 3;

interface NormalizedDef {
  key: PlatformColumnKey;
  exact: Set<string>;
  partial: string[];
}

const NORMALIZED_CACHE = new Map<SheetType, NormalizedDef[]>();

function normalizedDefs(type: SheetType): NormalizedDef[] {
  const cached = NORMALIZED_CACHE.get(type);
  if (cached) return cached;

  const built = getColumnsForType(type).map((def) => {
    const forms = [def.label, ...def.aliases].map(normalizeColumnName).filter(Boolean);
    return {
      key: def.key,
      exact: new Set(forms),
      partial: forms.filter((f) => f.length >= MIN_PARTIAL_LENGTH),
    };
  });
  NORMALIZED_CACHE.set(type, built);
  return built;
}

/**
 * 열 하나를 플랫폼 항목에 맞춰본다.
 * 1) 정규화 후 완전일치 → 2) 접두/접미 부분일치. 둘 다 아니면 연결하지 않는다.
 * (가운데 걸치는 포함관계는 오연결이 많아 쓰지 않는다)
 */
function matchColumn(
  column: string,
  type: SheetType,
  used: Set<PlatformColumnKey>,
): PlatformColumnKey | null {
  const norm = normalizeColumnName(column);
  if (!norm) return null;

  const defs = normalizedDefs(type);

  for (const def of defs) {
    if (used.has(def.key)) continue;
    if (def.exact.has(norm)) return def.key;
  }

  // 부분일치는 긴 후보를 먼저 본다. '입고수량'이 '입고'보다 앞서야 한다.
  let best: { key: PlatformColumnKey; length: number } | null = null;
  for (const def of defs) {
    if (used.has(def.key)) continue;
    for (const form of def.partial) {
      if (!norm.startsWith(form) && !norm.endsWith(form)) continue;
      if (!best || form.length > best.length) best = { key: def.key, length: form.length };
    }
  }
  return best?.key ?? null;
}

export function autoMapColumns(
  excelColumns: string[],
  type: SheetType = 'generic',
): Record<string, PlatformColumnKey | null> {
  const mapping: Record<string, PlatformColumnKey | null> = {};
  const usedTargets = new Set<PlatformColumnKey>();

  // 완전일치를 먼저 전부 확정한 뒤 부분일치를 채운다.
  // (순서가 섞이면 앞쪽의 느슨한 매칭이 뒤쪽의 정확한 열을 가로챈다)
  const pending: string[] = [];
  for (const col of excelColumns) {
    const norm = normalizeColumnName(col);
    const exact = norm
      ? normalizedDefs(type).find((d) => !usedTargets.has(d.key) && d.exact.has(norm))
      : undefined;
    if (exact) {
      usedTargets.add(exact.key);
      mapping[col] = exact.key;
    } else {
      pending.push(col);
      mapping[col] = null;
    }
  }

  for (const col of pending) {
    const matched = matchColumn(col, type, usedTargets);
    if (matched) usedTargets.add(matched);
    mapping[col] = matched;
  }

  return mapping;
}

/** 이 열 이름들이 해당 유형에서 몇 개나 알아볼 수 있는지. 헤더·유형 탐지의 점수다. */
export function scoreColumns(columns: string[], type: SheetType): number {
  const mapping = autoMapColumns(columns, type);
  return Object.values(mapping).filter(Boolean).length;
}

/** 열 이름만 보고 시트 유형을 고른다. 동점이면 시트 이름 힌트로 가른다. */
export function detectSheetTypeByHeaders(columns: string[], sheetName = ''): SheetType {
  const hint = detectSheetTypeByName(sheetName);
  let best: { type: SheetType; score: number } | null = null;

  for (const type of SHEET_TYPES) {
    const score = scoreColumns(columns, type) + (hint === type ? 0.5 : 0);
    if (!best || score > best.score) best = { type, score };
  }
  return best && best.score > 0 ? best.type : (hint ?? 'generic');
}

// ── 인식 판정 ─────────────────────────────────────────────

export interface RecognitionResult {
  ok: boolean;
  /** 연결되지 않은 필수 항목 */
  missingRequired: PlatformColumnDef[];
  /** "이 중 최소 하나"를 만족하지 못한 핵심 열 그룹 */
  missingCoreGroups: PlatformColumnDef[][];
}

/**
 * 시트가 업무 자료로 인정되는지. 필수 항목 + 핵심 열 그룹을 함께 본다.
 * 어떤 항목이 모자란지 그대로 돌려주므로 화면에서 이유를 보여줄 수 있다.
 */
export function checkRecognition(
  type: SheetType,
  mappedKeys: Set<PlatformColumnKey>,
): RecognitionResult {
  const defs = getColumnsForType(type);
  const byKey = new Map(defs.map((d) => [d.key, d]));

  const missingRequired = defs.filter((d) => d.required && !mappedKeys.has(d.key));

  const missingCoreGroups = CORE_COLUMN_GROUPS[type]
    .filter((group) => !group.some((key) => mappedKeys.has(key)))
    .map((group) => group.map((key) => byKey.get(key)).filter((d): d is PlatformColumnDef => !!d));

  return {
    ok: mappedKeys.size > 0 && missingRequired.length === 0 && missingCoreGroups.length === 0,
    missingRequired,
    missingCoreGroups,
  };
}
