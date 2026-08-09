// 엑셀 해석 엔진 v2 — 값 정규화.
//
// 원칙: 추측하지 않는다.
//   읽을 수 있으면 값,
//   비운 칸이면 null(정상),
//   읽을 수 없으면 null + 오류 (사용자에게 무엇을 확인해야 하는지 알린다).
// 절대 new Date(문자열)로 광범위 추측 파싱을 하지 않는다.
import { toText } from './text';

export type ParseState = 'empty' | 'ok' | 'invalid';

export interface ParsedValue<T> {
  value: T | null;
  state: ParseState;
  /** state === 'invalid' 일 때 사용자에게 보여줄 설명. */
  message?: string;
}

/**
 * 숫자·날짜 칸에서 "값 없음"을 뜻하는 것이 분명한 표기. 오류가 아니다.
 *
 * 문자 칸에는 쓰지 않는다. 실제 서식에서 O/X 는 "예/아니오"라는 값이고,
 * '-' 나 '.' 도 그 자체가 기재 내용일 수 있다. 문자 칸에서 이걸 빈 값으로 지우면
 * 사용자가 적은 답이 조용히 사라진다.
 */
const BLANK_TOKENS = new Set([
  '', '-', '–', '—', 'ㅡ', '.', '..', '...', '없음', '해당없음',
  '미해당', '해당사항없음', 'na', 'n/a', 'null', 'nil',
]);

function isBlankToken(s: string): boolean {
  return BLANK_TOKENS.has(s) || BLANK_TOKENS.has(s.toLowerCase());
}

// ── 문자 ──────────────────────────────────────────────────

/**
 * 앞뒤 공백 제거 + 내부 연속 공백 한 칸. 값 자체는 바꾸지 않는다.
 * 빈칸이 아닌 것은 무엇이든 값으로 본다. (문자 칸에서는 무엇도 임의로 지우지 않는다)
 */
export function parseTextValue(raw: unknown): ParsedValue<string> {
  const s = toText(raw).normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (s === '') return { value: null, state: 'empty' };
  return { value: s, state: 'ok' };
}

// ── 숫자 ──────────────────────────────────────────────────

/** 수량 뒤에 붙는 단위. "1,000개" → 1000 */
const TRAILING_UNIT = /(개|명|건|박스|상자|세트|팩|병|캔|봉|포|매|장|권|대|kg|g|t|ml|l|원|ea|box|pcs|point|점)$/i;

/**
 * "1,000" → 1000, "1,000개" → 1000, "(500)" → -500.
 * 숫자로 볼 수 없으면 invalid. 조용히 0으로 바꾸지 않는다.
 */
export function parseNumberValue(raw: unknown): ParsedValue<number> {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { value: null, state: 'invalid', message: '숫자로 읽을 수 없습니다' };
    return { value: raw, state: 'ok' };
  }

  let s = toText(raw).normalize('NFKC').trim();
  if (isBlankToken(s)) return { value: null, state: 'empty' };

  let sign = 1;
  // 회계 표기 (500) = -500
  const paren = s.match(/^\((.+)\)$/);
  if (paren) {
    sign = -1;
    s = paren[1].trim();
  }

  s = s.replace(/^약\s*/, '');
  s = s.replace(/,/g, '').replace(/\s+/g, '');

  // 단위는 여러 개 붙을 수 있다. "10박스개" 같은 건 없지만 "10kg" → "10"
  let guard = 0;
  while (TRAILING_UNIT.test(s) && guard++ < 4) {
    s = s.replace(TRAILING_UNIT, '');
  }

  if (!s || isBlankToken(s)) return { value: null, state: 'empty' };

  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) {
    return { value: null, state: 'invalid', message: `숫자가 아닙니다: "${toText(raw).trim()}"` };
  }

  const num = Number(s) * sign;
  if (!Number.isFinite(num)) {
    return { value: null, state: 'invalid', message: `숫자로 읽을 수 없습니다: "${toText(raw).trim()}"` };
  }
  return { value: num, state: 'ok' };
}

// ── 날짜 ──────────────────────────────────────────────────

/**
 * 엑셀 날짜 일련번호의 정상 범위.
 * 20000 = 1954-10-03, 73415 = 2100-12-31.
 * 이 밖의 숫자(수량 등)를 날짜로 오해하지 않기 위한 방어선이다.
 * (1900 윤년 버그 구간인 60 이하도 자연히 배제된다)
 */
const SERIAL_MIN = 20000;
const SERIAL_MAX = 73415;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2200) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * 엑셀 일련번호 → YYYY-MM-DD.
 * UTC로만 계산하고 UTC 값만 읽는다. 로컬 시간대(KST)를 한 번도 거치지 않으므로
 * 날짜가 하루 밀리지 않는다.
 */
function serialToYmd(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < SERIAL_MIN || serial > SERIAL_MAX) return null;
  const days = Math.floor(serial);
  const date = new Date((days - 25569) * 86400000);
  if (isNaN(date.getTime())) return null;
  return ymd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** 지원하는 표기만 명시적으로 받는다. 그 밖은 전부 invalid. */
export function parseDateValue(raw: unknown): ParsedValue<string> {
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return { value: null, state: 'invalid', message: '날짜를 읽을 수 없습니다' };
    return { value: ymd(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate()), state: 'ok' };
  }

  if (typeof raw === 'number') {
    const fromSerial = serialToYmd(raw);
    if (fromSerial) return { value: fromSerial, state: 'ok' };
    return {
      value: null,
      state: 'invalid',
      message: `날짜로 볼 수 없는 숫자입니다: ${raw}`,
    };
  }

  const original = toText(raw).trim();
  const s = original.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (isBlankToken(s)) return { value: null, state: 'empty' };

  // 2026-08-03 / 2026.08.03 / 2026/08/03
  const iso = s.match(/^(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\.?$/);
  if (iso) {
    const [, y, m, d] = iso.map(Number) as unknown as [unknown, number, number, number];
    return isValidYmd(y, m, d)
      ? { value: ymd(y, m, d), state: 'ok' }
      : { value: null, state: 'invalid', message: `달력에 없는 날짜입니다: "${original}"` };
  }

  // 2026년 8월 3일
  const kor = s.match(/^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?$/);
  if (kor) {
    const [, y, m, d] = kor.map(Number) as unknown as [unknown, number, number, number];
    return isValidYmd(y, m, d)
      ? { value: ymd(y, m, d), state: 'ok' }
      : { value: null, state: 'invalid', message: `달력에 없는 날짜입니다: "${original}"` };
  }

  // 20260803
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const y = Number(compact[1]);
    const m = Number(compact[2]);
    const d = Number(compact[3]);
    return isValidYmd(y, m, d)
      ? { value: ymd(y, m, d), state: 'ok' }
      : { value: null, state: 'invalid', message: `달력에 없는 날짜입니다: "${original}"` };
  }

  // 문자열로 들어온 일련번호 ("45000")
  if (/^\d{5}$/.test(s)) {
    const fromSerial = serialToYmd(Number(s));
    if (fromSerial) return { value: fromSerial, state: 'ok' };
  }

  // 연도가 없는 "8/3", 연도만 있는 "2026", "미정" 등은 추측하지 않는다.
  return {
    value: null,
    state: 'invalid',
    message: `날짜를 알 수 없습니다: "${original}" (예: 2026-08-03)`,
  };
}

/** 생년월일은 YYMMDD 6자리 관행이 흔하다. 그 경우만 추가로 받는다. */
export function parseBirthDateValue(raw: unknown): ParsedValue<string> {
  const digits =
    typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 999999
      ? String(Math.round(raw)).padStart(6, '0')
      : toText(raw).trim().replace(/[.\-/]/g, '');

  if (/^\d{6}$/.test(digits)) {
    const yy = Number(digits.slice(0, 2));
    const m = Number(digits.slice(2, 4));
    const d = Number(digits.slice(4, 6));
    // 00~30 → 2000년대, 31~99 → 1900년대. (기존 main과 같은 규칙)
    const year = yy <= 30 ? 2000 + yy : 1900 + yy;
    if (isValidYmd(year, m, d)) return { value: ymd(year, m, d), state: 'ok' };
    return { value: null, state: 'invalid', message: `생년월일을 알 수 없습니다: "${toText(raw).trim()}"` };
  }

  const parsed = parseDateValue(raw);
  if (parsed.state === 'invalid') {
    return { value: null, state: 'invalid', message: `생년월일을 알 수 없습니다: "${toText(raw).trim()}"` };
  }
  return parsed;
}
