// 중앙 DB에서 읽어온 제출 자료를 화면 문구로 바꾸는 helper.
// 값을 새로 만들지 않는다. 이미 저장된 값에서 계산할 수 있는 것만 돌려준다.
import { extractEupMyeonDong } from './address';

const SHEET_TYPE_LABELS: Record<string, string> = {
  performance: '주간 실적',
  referral: '복지 연계',
  generic: '물품·재고',
};

export function sheetTypeLabel(type?: string): string {
  return SHEET_TYPE_LABELS[type ?? ''] ?? '기타 자료';
}

export interface TypeSummary {
  type: string;
  label: string;
  count: number;
}

// ── 기간 ──────────────────────────────────────────────────
function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
}

export function formatPeriod(minIso: string, maxIso: string): string {
  const [, minM, minD] = minIso.split('-').map(Number);
  const [, maxM, maxD] = maxIso.split('-').map(Number);

  if (minIso === maxIso) return `${maxM}월 ${maxD}일`;
  // 한 주 안에 들어오면 주차로 읽는 편이 업무 감각에 맞다.
  if (minM === maxM && dayDiff(minIso, maxIso) <= 6) {
    return `${maxM}월 ${Math.ceil(maxD / 7)}주`;
  }
  return `${minM}월 ${minD}일 ~ ${maxM}월 ${maxD}일`;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 목록의 "업데이트" 칸. 오늘/어제는 상대 표기가 읽기 쉽다. */
export function formatUpdatedAt(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '—';

  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (diffDays === 0) {
    return `오늘 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  if (diffDays === 1) return '어제';
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  }
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
}

/** 월요일 시작 기준 이번 주에 올라온 자료인지. */
export function isSubmittedThisWeek(iso: string, now: Date = new Date()): boolean {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return false;
  const weekday = (now.getDay() + 6) % 7; // 월=0
  const weekStart = startOfDay(now) - weekday * 86400000;
  return date.getTime() >= weekStart;
}

// ── 파일 이름 ─────────────────────────────────────────────
// 읍면동마다 같은 서식을 내려받아 쓰기 때문에 파일 이름이 그대로 겹친다.
// 다른 동끼리 겹치는 것은 그대로 둔다. 어차피 목록에 기관명이 함께 나온다.
//
// 문제는 같은 동 안에서 같은 이름이 다시 올라올 때다. DB(create_submission)가 이전
// 자료를 superseded 로 내려 집계에서 빼기 때문에, 덮어쓸 생각이 없었다면 예전 자료가
// 말없이 사라진다. 그래서 저장 전에 어느 쪽인지 물어본다.

/** 이름 비교용 키. 표기 차이(자모 조합·대소문자·앞뒤 공백)로 다른 이름이 되지 않게. */
export function fileNameKey(name: string): string {
  return name.normalize('NFC').trim().toLowerCase();
}

function splitExtension(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { stem: name, ext: '' };
  return { stem: name.slice(0, dot), ext: name.slice(dot) };
}

/** 같은 기관 안에서 이름이 겹치는 자료. 다른 기관 자료는 보지 않는다. */
export function findSameOrganizationConflicts<
  T extends { fileName: string; organizationId: string },
>(registered: readonly T[], fileName: string, organizationId: string): T[] {
  if (!organizationId) return [];
  const key = fileNameKey(fileName);
  if (!key) return [];
  return registered.filter(
    (r) => r.organizationId === organizationId && fileNameKey(r.fileName) === key,
  );
}

/**
 * 이미 쓰인 이름과 겹치지 않는 이름을 제안한다.
 * 읍면동 이름을 앞에 붙이는 것이 가장 알아보기 쉽다. 그래도 겹치면 번호를 붙인다.
 * 확장자는 그대로 둔다.
 */
export function suggestUniqueFileName(
  name: string,
  takenNames: Iterable<string>,
  organizationName?: string,
): string {
  const taken = new Set(Array.from(takenNames, fileNameKey));
  const { stem, ext } = splitExtension(name.trim());

  const candidates: string[] = [];
  if (organizationName && !stem.includes(organizationName)) {
    candidates.push(`${organizationName}_${stem}${ext}`);
  }
  for (let n = 2; n <= 50; n++) {
    if (organizationName && !stem.includes(organizationName)) {
      candidates.push(`${organizationName}_${stem} (${n})${ext}`);
    }
    candidates.push(`${stem} (${n})${ext}`);
  }

  for (const candidate of candidates) {
    if (!taken.has(fileNameKey(candidate))) return candidate;
  }
  return `${stem} (사본)${ext}`;
}

// ── 개인정보 ──────────────────────────────────────────────
// 자료 관리·지역 상세는 다른 지역 담당자도 보는 화면이다. 집계·운영 값은 그대로
// 보여주되 개인 식별 항목은 가려서 내보낸다.
const NAME_COL = /이름|성명|대상자/;
const BIRTH_COL = /생년월일/;
const ADDRESS_COL = /주소|거주지/;
const CONTACT_COL = /연락처|전화|휴대폰/;

export function isPersonalColumn(column: string): boolean {
  return (
    NAME_COL.test(column) ||
    BIRTH_COL.test(column) ||
    ADDRESS_COL.test(column) ||
    CONTACT_COL.test(column)
  );
}

function maskPersonalValue(column: string, value: string): string {
  const v = (value ?? '').trim();
  if (!v) return '';
  if (NAME_COL.test(column)) {
    return v.length <= 1 ? v : v[0] + '*'.repeat(v.length - 1);
  }
  if (ADDRESS_COL.test(column)) {
    return extractEupMyeonDong(v) ?? '비공개';
  }
  if (BIRTH_COL.test(column) || CONTACT_COL.test(column)) return '비공개';
  return v;
}

export function displayCellValue(column: string, value: string): string {
  return isPersonalColumn(column) ? maskPersonalValue(column, value) : (value ?? '');
}
