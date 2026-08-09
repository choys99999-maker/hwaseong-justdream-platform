// 엑셀 해석 엔진 v2 — 문자열 정규화.
//
// 읍면동·기관마다 같은 뜻의 열 이름을 다르게 쓴다.
//   "입고수량" / "입고 수량" / "입고량(개)" / "입고\n수량" / "입고수량('26.8.3 기준)"
// 이걸 전부 같은 것으로 보려면 비교 전에 같은 모양으로 깎아야 한다.
// 원본 이름은 절대 바꾸지 않는다. 비교용 키만 따로 만든다.

/** 셀 값을 문자열로. null/undefined는 빈 문자열. */
export function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** 줄바꿈·연속 공백을 한 칸으로. 화면에 보여줄 이름을 만들 때 쓴다. */
export function normalizeSpace(value: unknown): string {
  return toText(value).normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/**
 * 1단계 비교 키. 공백만 없앤다.
 * "연계완료 계(A)" → "연계완료계(a)"
 * 괄호 안의 (A)(B)(D) 같은 표식으로 열을 구분하는 양식이 있어서, 괄호를 지운 키만
 * 쓰면 서로 다른 열이 같은 키가 되어버린다. 그래서 두 단계로 나눈다.
 */
export function headerKeyStrict(value: unknown): string {
  return toText(value).normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

/** 날짜 기준 문구. "(2026.8.3 기준)", "8.3기준", "기준일" 등. */
const DATE_BASIS = /\d{1,4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]?\s*(?:\d{1,2}\s*일?)?\s*기준/g;
/** 단위 표현. "(단위: 개)", "단위:명" */
const UNIT_PHRASE = /단위\s*[:：]?\s*[가-힣a-z]*/g;
/** 괄호류 설명. 전각/반각 모두. */
const BRACKETS = /\([^)]*\)|（[^）]*）|\[[^\]]*\]|［[^］]*］|<[^>]*>|〈[^〉]*〉|｢[^｣]*｣/g;
/** 이름 구분에 의미 없는 기호. */
const PUNCT = /[·∙•・.,、/\\|+*※#'"`~^_=:;?!\-–—ㅡ]/g;

/**
 * 2단계 비교 키. 괄호 설명·날짜 기준 문구·단위·기호·공백을 모두 없앤다.
 * "입고수량('26.8.3 기준)" → "입고수량"
 * "출고 량 (단위: 개)"     → "출고량"
 */
export function headerKeyLoose(value: unknown): string {
  let s = toText(value).normalize('NFKC').toLowerCase();
  s = s.replace(/\s+/g, ' ');
  s = s.replace(BRACKETS, ' ');
  s = s.replace(DATE_BASIS, ' ');
  s = s.replace(/기준일자?|기준$/g, ' ');
  s = s.replace(UNIT_PHRASE, ' ');
  s = s.replace(PUNCT, ' ');
  s = s.replace(/\s+/g, '');
  return s;
}

/** 0-based 열 번호 → 엑셀 열 문자. 0 → A, 26 → AA */
export function colLetter(index: number): string {
  let letter = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

/** 셀 주소. (0-based 열, 1-based 행) → "C7" */
export function cellAddress(colIndex: number, rowNumber: number): string {
  return `${colLetter(colIndex)}${rowNumber}`;
}

export function hasKorean(s: string): boolean {
  return /[가-힣]/.test(s);
}

/** "2026-08-03", "(2026" 처럼 날짜로 시작하는 머리글. 열 이름으로 쓰기엔 부적절하다. */
export function looksLikeDateHeader(s: string): boolean {
  return /^\(?\d{4}\s*[.\-/년]/.test(s.trim()) || /^\d{1,2}\s*월\s*\d{0,2}\s*일?$/.test(s.trim());
}

/** 값이 숫자로만 이루어졌는지. 헤더 후보인지 판단할 때 쓴다. */
export function looksNumeric(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  const s = toText(value).trim();
  if (!s) return false;
  return /^[+-]?[\d,]+(\.\d+)?$/.test(s);
}
