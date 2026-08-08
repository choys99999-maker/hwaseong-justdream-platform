// 저장된 데이터셋(= 한 번의 자료 제출)을 업무 관점으로 읽어내는 helper.
// 새 데이터를 만들지 않는다. 이미 저장된 시트/열/값에서 계산할 수 있는 것만 돌려준다.
import type { SheetEntry, UploadedDataset } from '../store/dataStore';
import { findCol } from '../store/dataStore';
import { extractEupMyeonDong } from './address';

export const SHEET_TYPE_LABELS: Record<string, string> = {
  performance: '주간 실적',
  referral: '복지 연계',
  generic: '물품·재고',
};

export function sheetTypeLabel(type?: string): string {
  return SHEET_TYPE_LABELS[type ?? ''] ?? '기타 자료';
}

/** 멀티시트로 저장되지 않은 예전 자료도 같은 모양으로 다룬다. */
export function getSheets(dataset: UploadedDataset): SheetEntry[] {
  if (dataset.sheets && dataset.sheets.length > 0) return dataset.sheets;
  return [
    {
      sheetName: dataset.sheetName ?? '자료',
      sheetType: dataset.sheetType ?? 'generic',
      columns: dataset.columns,
      records: dataset.records,
    },
  ];
}

export interface TypeSummary {
  type: string;
  label: string;
  count: number;
}

/** 자료 유형별 건수. 같은 유형의 시트는 하나로 합친다. */
export function summarizeTypes(dataset: UploadedDataset): TypeSummary[] {
  const map = new Map<string, number>();
  for (const sheet of getSheets(dataset)) {
    if (sheet.records.length === 0) continue;
    map.set(sheet.sheetType, (map.get(sheet.sheetType) ?? 0) + sheet.records.length);
  }
  return Array.from(map, ([type, count]) => ({ type, label: sheetTypeLabel(type), count })).sort(
    (a, b) => b.count - a.count,
  );
}

export function totalRecordCount(dataset: UploadedDataset): number {
  return getSheets(dataset).reduce((sum, s) => sum + s.records.length, 0);
}

const REGION_COL_PATTERN = /읍면동|지역|권역|연계처/;
const ADDRESS_COL_PATTERN = /주소|거주지/;
const REGION_TOKEN = /[가-힣]{2,}\d*(?:읍|면|동)/;

/** 파일명에 읍면동이 들어 있으면 그것도 단서로 쓴다. (자료 안에서 못 찾은 경우만) */
function regionFromFileName(fileName: string): string | null {
  return fileName.match(REGION_TOKEN)?.[0] ?? null;
}

/** 자료가 다루는 읍면동 목록. 지역 열 → 주소 열 → 파일명 순으로 찾는다. */
export function deriveRegions(dataset: UploadedDataset): string[] {
  const found = new Set<string>();

  for (const sheet of getSheets(dataset)) {
    const regionCol = findCol(sheet.columns, REGION_COL_PATTERN);
    const addressCol = findCol(sheet.columns, ADDRESS_COL_PATTERN);
    if (!regionCol && !addressCol) continue;

    for (const record of sheet.records) {
      let value = regionCol ? (record[regionCol] ?? '').trim() : '';
      if (!value && addressCol) value = extractEupMyeonDong(record[addressCol] ?? '') ?? '';
      if (value && REGION_TOKEN.test(value)) found.add(value);
    }
  }

  if (found.size === 0) {
    const fromName = regionFromFileName(dataset.fileName);
    if (fromName) found.add(fromName);
  }

  return Array.from(found).sort((a, b) => a.localeCompare(b, 'ko'));
}

export function formatRegions(regions: string[]): string {
  if (regions.length === 0) return '지역 미지정';
  if (regions.length === 1) return regions[0];
  return `${regions[0]} 외 ${regions.length - 1}곳`;
}

const DATE_COL_PATTERN = /일자|입고일|지원일|날짜/;
const NOT_PERIOD_COL_PATTERN = /생년월일|유통기한|소비기한|유효기간/;

function toIsoDate(raw: string): string | null {
  const normalized = raw.trim().replace(/\./g, '-').replace(/\//g, '-');
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** 자료가 담고 있는 기간. 날짜 열이 없으면 null. */
export function derivePeriod(dataset: UploadedDataset): string | null {
  let min: string | null = null;
  let max: string | null = null;

  for (const sheet of getSheets(dataset)) {
    const dateCols = sheet.columns.filter(
      (c) => DATE_COL_PATTERN.test(c) && !NOT_PERIOD_COL_PATTERN.test(c),
    );
    if (dateCols.length === 0) continue;

    for (const record of sheet.records) {
      for (const col of dateCols) {
        const iso = toIsoDate(record[col] ?? '');
        if (!iso) continue;
        if (!min || iso < min) min = iso;
        if (!max || iso > max) max = iso;
      }
    }
  }

  if (!min || !max) return null;
  return formatPeriod(min, max);
}

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

// ── 개인정보 ──────────────────────────────────────────────
// 자료 관리는 다른 지역 담당자도 보는 화면이다. 집계·운영 값은 그대로 보여주되
// 개인 식별 항목은 가려서 내보낸다.
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

export function maskPersonalValue(column: string, value: string): string {
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
