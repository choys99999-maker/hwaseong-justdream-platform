/// <reference lib="webworker" />
import * as XLSX from 'xlsx';
import type {
  PlatformColumnKey,
  MappedRecord,
  ValidationError,
  SheetType,
  SheetParseResult,
  SheetConvertResult,
} from '../types/upload';
import {
  detectSheetType,
  detectSheetTypeByHeaders,
  scoreColumns,
  SHEET_TYPES,
} from '../utils/columnMapping';

interface SheetData {
  rows: unknown[][];
  headers: Array<{ name: string; idx: number }>;
  sheetType: SheetType;
  dataStartRow: number;
  headerRowIndex: number;
  headerRowCount: number;
}

const storedSheets = new Map<string, SheetData>();

/** 헤더를 찾아볼 상단 범위. 제목·작성자·공백 줄이 몇 개 얹혀도 여기서 걸린다. */
const MAX_HEADER_SCAN_ROWS = 12;
/** 병합 헤더로 묶어볼 최대 행 수. (실적 서식이 3행) */
const MAX_HEADER_ROWS = 3;
/** 헤더로 인정하는 최소 조건. 이보다 못 알아보면 표의 머리로 보지 않는다. */
const MIN_HEADER_COLUMNS = 2;
const MIN_HEADER_SCORE = 2;

const NUMBER_FIELDS_BY_TYPE: Record<SheetType, Set<PlatformColumnKey>> = {
  performance: new Set([
    'userCount', 'basicConsultation', 'referralTotal', 'linkageCompleted',
    'basicLivelihood', 'nearPoverty', 'emergencyWelfare', 'otherLinkage',
    'underReview', 'noLinkageNeeded',
  ]),
  referral: new Set(['serialNo']),
  generic: new Set(['inboundQuantity', 'outboundQuantity', 'stock']),
};

const DATE_FIELDS = new Set<PlatformColumnKey>(['consultDate', 'inboundDate', 'expirationDate']);

const FIELD_LABELS: Partial<Record<PlatformColumnKey, string>> = {
  institution: '구분/기관명', userCount: '이용자', basicConsultation: '기본상담',
  referralTotal: '상담연계의뢰', linkageCompleted: '연계완료', basicLivelihood: '기초생활',
  nearPoverty: '차상위', emergencyWelfare: '긴급복지', otherLinkage: '기타',
  underReview: '검토중', noLinkageNeeded: '연계불요',
  serialNo: '연번', visitType: '방문구분', clientName: '대상자이름',
  birthDate: '생년월일', address: '주소', consultDate: '상담일자',
  referralTarget: '연계처', consultationDone: '연계상담실시', linkageType: '연계완료',
  serviceDetails: '기타내역',
  region: '지역', organization: '기관명', itemName: '품목명',
  inboundQuantity: '입고수량', outboundQuantity: '출고수량', stock: '현재재고',
  inboundDate: '입고일', expirationDate: '유통기한',
};

function colLetter(idx: number): string {
  let letter = '';
  let n = idx + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

function hasKorean(s: string): boolean {
  return /[가-힣]/.test(s);
}

function isDateLike(s: string): boolean {
  return /^\d{4}[./\-]/.test(s) || /^\(\d{4}/.test(s);
}

function buildFlatColName(cells: string[]): string {
  const normalized = cells.map((c) => c.trim().replace(/\n/g, ' '));

  for (let i = normalized.length - 1; i >= 0; i--) {
    const s = normalized[i];
    if (s && hasKorean(s) && !isDateLike(s)) return s;
  }
  for (let i = normalized.length - 1; i >= 0; i--) {
    const s = normalized[i];
    if (s && !isDateLike(s)) return s;
  }
  for (let i = normalized.length - 1; i >= 0; i--) {
    if (normalized[i]) return normalized[i];
  }
  return '';
}

/** 지정한 구간을 헤더로 보고 열 이름을 만든다. */
function buildHeaders(
  allRows: unknown[][],
  startIdx: number,
  rowCount: number,
): Array<{ name: string; idx: number }> {
  const headerRows = allRows.slice(startIdx, startIdx + rowCount) as unknown[][];
  const colCount = headerRows.length > 0
    ? Math.max(...headerRows.map((r) => (r as unknown[]).length))
    : 0;

  // 같은 이름의 열이 두 개 이상이면 뒤쪽 열이 앞쪽 열을 덮어써 값이 통째로 사라진다.
  // (열 이름이 매핑·미리보기의 키로 쓰이기 때문) 번호를 붙여 구분한다.
  const headers: Array<{ name: string; idx: number }> = [];
  const usedNames = new Map<string, number>();
  for (let col = 0; col < colCount; col++) {
    const cells = headerRows.map((r) => String((r as unknown[])[col] ?? ''));
    const name = buildFlatColName(cells);
    if (!name) continue;
    const seen = usedNames.get(name) ?? 0;
    usedNames.set(name, seen + 1);
    headers.push({ name: seen === 0 ? name : `${name} (${seen + 1})`, idx: col });
  }
  return headers;
}

interface HeaderChoice {
  startIdx: number;
  rowCount: number;
  headers: Array<{ name: string; idx: number }>;
  sheetType: SheetType;
  score: number;
}

/**
 * 헤더 위치와 시트 유형을 함께 찾는다.
 *
 * 예전에는 유형별로 "몇 번째 행부터 몇 줄이 헤더"인지 상수로 박아두고, 유형은 시트
 * '이름'으로만 정했다. 그래서 제목 줄이 하나만 얹혀도 제목을 헤더로 읽었고,
 * 시트 이름이 다르면 멀쩡한 표도 못 알아봤다.
 *
 * 이제는 상단 몇 줄을 훑으면서 (시작행 × 헤더줄수 × 유형) 조합마다 "열 이름을 몇 개나
 * 알아볼 수 있는지"를 점수로 매기고 가장 높은 조합을 택한다. 시트 이름은 동점일 때만 쓴다.
 */
function detectHeader(allRows: unknown[][], sheetName: string): HeaderChoice | null {
  let best: HeaderChoice | null = null;
  const limit = Math.min(MAX_HEADER_SCAN_ROWS, allRows.length);

  for (let start = 0; start < limit; start++) {
    const row = allRows[start] as unknown[];
    if (!row || !row.some((c) => String(c ?? '').trim() !== '')) continue;

    for (let count = 1; count <= MAX_HEADER_ROWS && start + count <= allRows.length; count++) {
      const headers = buildHeaders(allRows, start, count);
      if (headers.length < MIN_HEADER_COLUMNS) continue;

      const names = headers.map((h) => h.name);
      for (const type of SHEET_TYPES) {
        const raw = scoreColumns(names, type);
        if (raw < MIN_HEADER_SCORE) continue;

        const score = raw + (detectSheetType(sheetName) === type ? 0.5 : 0);

        // 같은 점수면 머리글을 더 깊게 잡는 쪽을 택한다. 점수가 유지된다는 것은
        // 그 줄이 데이터가 아니라 부제·2단 헤더라는 뜻이고, 데이터로 넘기면
        // '(2차 이용)' 같은 칸이 숫자 오류로 잡힌다.
        const dataStart = start + count;
        const better =
          !best ||
          score > best.score ||
          (score === best.score &&
            (dataStart > best.startIdx + best.rowCount ||
              (dataStart === best.startIdx + best.rowCount && start < best.startIdx)));

        if (better) {
          best = { startIdx: start, rowCount: count, headers, sheetType: type, score };
        }
      }
    }
  }
  return best;
}

function parseSheetData(ws: XLSX.WorkSheet, sheetName: string): SheetData {
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

  const detected = detectHeader(allRows, sheetName);

  let startIdx: number;
  let rowCount: number;
  let headers: Array<{ name: string; idx: number }>;
  let sheetType: SheetType;

  if (detected) {
    ({ startIdx, rowCount, headers } = detected);
    sheetType = detected.sheetType;
  } else {
    // 아무것도 못 알아본 시트(설명 시트 등). 첫 내용 줄을 헤더로 두고 넘긴다.
    startIdx = allRows.findIndex((r) =>
      (r as unknown[]).some((c) => String(c ?? '').trim() !== ''),
    );
    if (startIdx < 0) startIdx = 0;
    rowCount = 1;
    headers = buildHeaders(allRows, startIdx, 1);
    sheetType = detectSheetTypeByHeaders(headers.map((h) => h.name), sheetName);
  }

  const headerEndIdx = startIdx + rowCount;

  return {
    rows: allRows.slice(headerEndIdx),
    headers,
    sheetType,
    dataStartRow: headerEndIdx + 1,
    headerRowIndex: startIdx + 1,
    headerRowCount: rowCount,
  };
}

function handleParse(buffer: ArrayBuffer) {
  const wb = XLSX.read(buffer, { type: 'array' });
  storedSheets.clear();

  const sheets: SheetParseResult[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const data = parseSheetData(ws, sheetName);
    const sheetType = data.sheetType;

    storedSheets.set(sheetName, data);

    const columns = data.headers.map((h) => h.name);
    const previewRows = data.rows.slice(0, 10).map((row) => {
      const arr = row as unknown[];
      return Object.fromEntries(
        data.headers.map(({ name, idx }) => [name, String(arr[idx] ?? '')]),
      );
    });

    sheets.push({
      sheetName,
      sheetType,
      columns,
      previewRows,
      totalRows: data.rows.length,
      headerRowIndex: data.headerRowIndex,
      headerRowCount: data.headerRowCount,
    });
  }

  self.postMessage({ type: 'parse-done', sheets });
}

/**
 * 미리보기 전용 읽기 전용 조회.
 * 이미 parse 단계에서 읽어둔 원본 행을 요청한 구간만큼 잘라 돌려줄 뿐,
 * 값을 해석하거나 바꾸지 않는다. (변환·검증 경로와 완전히 분리)
 */
function handlePreviewRows(sheetName: string, start: number, limit: number) {
  const data = storedSheets.get(sheetName);
  if (!data) {
    self.postMessage({
      type: 'preview-rows-done',
      sheetName, start, columns: [], rows: [], rowNumbers: [], totalRows: 0,
    });
    return;
  }

  const { rows, headers, dataStartRow } = data;

  // 표 아래에 남은 빈 줄까지 보여주면 "제대로 읽혔나"를 판단하기 어렵다. 빈 줄은 건너뛴다.
  const filled: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const arr = rows[i] as unknown[];
    if (headers.some(({ idx }) => String(arr[idx] ?? '').trim() !== '')) filled.push(i);
  }

  const slice = filled.slice(start, start + limit);
  const cells = slice.map((rowIdx) => {
    const arr = rows[rowIdx] as unknown[];
    return headers.map(({ idx }) => {
      const v = arr[idx];
      if (v === null || v === undefined) return '';
      if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v;
      return String(v);
    });
  });

  self.postMessage({
    type: 'preview-rows-done',
    sheetName,
    start,
    columns: headers.map((h) => h.name),
    rows: cells,
    rowNumbers: slice.map((i) => dataStartRow + i),
    totalRows: filled.length,
  });
}

// ── 날짜 ──────────────────────────────────────────────────
// 알아보는 형식만 받고 나머지는 전부 오류로 돌린다.
// 예전에는 마지막에 new Date(s)로 아무 문자열이나 받아넘겼는데, 그 관대함이
// 조용한 오염을 만들었다. ('8/3' → 2001년, 'Aug 3 2026' → KST에서 하루 밀림,
// '2026' → 2026-01-01) 오류로 잡히지도 않아 그대로 저장됐다.

/** 엑셀 날짜 일련번호 ↔ 1970-01-01 사이의 일수 차이. */
const EXCEL_EPOCH_OFFSET = 25569;
/**
 * 1927-05-18 ~ 2100-01-01.
 * 아래로 더 내리지 않는 이유: '1985', '2026' 같은 네 자리 숫자는 일련번호가 아니라
 * 연도로 적힌 값이다. 이걸 일련번호로 읽으면 1905년 같은 엉뚱한 날짜가 조용히 생긴다.
 * 범위 밖은 오류로 돌려 사용자가 원본을 고치게 한다.
 */
const SERIAL_MIN = 10000;
const SERIAL_MAX = 73051;

function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function toIso(y: number, m: number, d: number): string | null {
  if (!isRealDate(y, m, d)) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 두 자리 연도. 00~79는 2000년대, 80~99는 1900년대로 읽는다. */
function expandYear(yy: number): number {
  return yy <= 79 ? 2000 + yy : 1900 + yy;
}

function serialToIso(n: number): string | null {
  if (!Number.isFinite(n) || n < SERIAL_MIN || n > SERIAL_MAX) return null;
  // UTC로만 계산한다. 로컬 시간대를 거치면 KST에서 하루가 밀린다.
  const d = new Date(Math.round((n - EXCEL_EPOCH_OFFSET) * 86400000));
  if (isNaN(d.getTime())) return null;
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function parseDate(val: unknown): string | null {
  if (val === '' || val === null || val === undefined) return null;

  if (typeof val === 'number') {
    const fromSerial = serialToIso(val);
    if (fromSerial) return fromSerial;
    // 20260803처럼 숫자로 적힌 8자리 날짜는 아래 문자열 경로에서 받는다.
  }

  const s = String(val).trim();
  if (!s) return null;

  // 2026-08-03 / 2026.8.3 / 2026/8/3
  const full = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\.?$/);
  if (full) return toIso(+full[1], +full[2], +full[3]);

  // 26.8.3 / 26-8-3 (두 자리 연도)
  const short = s.match(/^(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})\.?$/);
  if (short) return toIso(expandYear(+short[1]), +short[2], +short[3]);

  // 20260803
  if (/^\d{8}$/.test(s)) return toIso(+s.slice(0, 4), +s.slice(4, 6), +s.slice(6, 8));

  // 2026년 8월 3일
  const kor = s.match(/^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?$/);
  if (kor) return toIso(+kor[1], +kor[2], +kor[3]);

  return null;
}

function parseBirthDate(val: unknown): string | null {
  if (val === '' || val === null || val === undefined) return null;

  if (typeof val === 'number') {
    const s = String(Math.round(val));
    if (/^\d{6}$/.test(s)) {
      const yy = parseInt(s.slice(0, 2));
      const mm = s.slice(2, 4);
      const dd = s.slice(4, 6);
      const year = yy >= 0 && yy <= 30 ? 2000 + yy : 1900 + yy;
      return `${year}-${mm}-${dd}`;
    }
  }

  const s = String(val).trim();
  if (/^\d{6}$/.test(s)) {
    const yy = parseInt(s.slice(0, 2));
    const mm = s.slice(2, 4);
    const dd = s.slice(4, 6);
    const year = yy >= 0 && yy <= 30 ? 2000 + yy : 1900 + yy;
    return `${year}-${mm}-${dd}`;
  }

  return parseDate(val);
}

/**
 * 소계·합계처럼 표 안에 섞인 집계 행인지.
 * 이런 행을 그대로 가져오면 같은 값을 두 번 세게 된다.
 * (품목 3종짜리 표가 소계 2행 + 합계 1행 때문에 6건이 되고 수량은 3배가 된다)
 */
const SUMMARY_LABEL = /^(소?계|합계|총계|총합|중간합계|누계|subtotal|total|sum)$/i;

function isSummaryRow(
  arr: unknown[],
  colMap: Map<PlatformColumnKey, number>,
  numberFields: Set<PlatformColumnKey>,
): boolean {
  for (const [key, idx] of colMap) {
    // 숫자·날짜 칸이 아니라 이름/구분 칸에 '합계'가 적혀 있어야 집계 행이다.
    if (numberFields.has(key) || DATE_FIELDS.has(key)) continue;
    const v = String(arr[idx] ?? '').replace(/\s+/g, '');
    if (v && SUMMARY_LABEL.test(v)) return true;
  }
  return false;
}

function handleConvert(sheetMappings: Record<string, Record<string, string | null>>) {
  const results: SheetConvertResult[] = [];

  for (const [sheetName, mapping] of Object.entries(sheetMappings)) {
    const data = storedSheets.get(sheetName);
    if (!data) continue;

    const { rows, headers, dataStartRow, sheetType } = data;
    const NUMBER_FIELDS = NUMBER_FIELDS_BY_TYPE[sheetType];
    const records: MappedRecord[] = [];
    const errors: ValidationError[] = [];
    let skippedSummaryRows = 0;

    const colMap = new Map<PlatformColumnKey, number>();
    for (const header of headers) {
      const target = mapping[header.name];
      if (target) colMap.set(target as PlatformColumnKey, header.idx);
    }

    for (let i = 0; i < rows.length; i++) {
      const arr = rows[i] as unknown[];
      const rowIndex = dataStartRow + i;

      const allEmpty = Array.from(colMap.values()).every(
        (idx) => String(arr[idx] ?? '').trim() === '',
      );
      if (allEmpty) continue;

      if (isSummaryRow(arr, colMap, NUMBER_FIELDS)) {
        skippedSummaryRows++;
        continue;
      }

      const record: MappedRecord = {};

      for (const [key, idx] of colMap) {
        const rawVal = arr[idx];
        const strVal = String(rawVal ?? '').trim();

        const cell = `${colLetter(idx)}${rowIndex}`;

        if (key === 'birthDate') {
          if (strVal) {
            const dateStr = parseBirthDate(rawVal);
            if (!dateStr) {
              errors.push({ rowIndex, field: key, cellAddress: cell, message: `생년월일을 인식할 수 없습니다: "${strVal}"` });
            } else {
              record[key] = dateStr;
            }
          }
        } else if (NUMBER_FIELDS.has(key)) {
          if (strVal) {
            const num = Number(strVal.replace(/,/g, ''));
            if (isNaN(num)) {
              errors.push({
                rowIndex,
                field: key,
                cellAddress: cell,
                message: `${FIELD_LABELS[key] ?? key} 값이 숫자가 아닙니다: "${strVal}"`,
              });
            } else if (key === 'stock' && num < 0) {
              errors.push({ rowIndex, field: key, cellAddress: cell, message: `재고가 음수입니다: ${num}` });
            } else {
              record[key] = num;
            }
          }
        } else if (DATE_FIELDS.has(key)) {
          if (strVal) {
            const dateStr = parseDate(rawVal);
            if (!dateStr) {
              errors.push({
                rowIndex,
                field: key,
                cellAddress: cell,
                message: `${FIELD_LABELS[key] ?? key} 날짜를 인식할 수 없습니다: "${strVal}"`,
              });
            } else {
              record[key] = dateStr;
            }
          }
        } else {
          if (strVal) record[key] = strVal;
        }
      }

      records.push(record);
    }

    results.push({ sheetName, records, errors, skippedSummaryRows });
  }

  self.postMessage({ type: 'convert-done', sheets: results });
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as {
    type: string;
    buffer?: ArrayBuffer;
    sheetMappings?: Record<string, Record<string, string | null>>;
    sheetName?: string;
    start?: number;
    limit?: number;
  };
  try {
    if (msg.type === 'parse' && msg.buffer) handleParse(msg.buffer);
    else if (msg.type === 'convert') handleConvert(msg.sheetMappings ?? {});
    else if (msg.type === 'preview-rows') {
      handlePreviewRows(msg.sheetName ?? '', msg.start ?? 0, msg.limit ?? 100);
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.',
    });
  }
};
