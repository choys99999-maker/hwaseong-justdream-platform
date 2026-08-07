/// <reference lib="webworker" />
import * as XLSX from 'xlsx';

interface WorkerChecks {
  missingColumns: string[];
  duplicateColumns: string[];
  listColumns: string[];
}

export interface SheetSummary {
  name: string;
  rows: number;
  cols: number;
  hasData: boolean;
}

let storedWorkbook: XLSX.WorkBook | null = null;
let storedSheetName = '';
let storedRows: unknown[][] = [];
let storedDataRows: unknown[][] = [];
let storedHeaders: Array<{ name: string; idx: number }> = [];

/** 항목 이름 행을 찾기 위해 훑어볼 최대 행 수. */
const HEADER_SCAN_LIMIT = 20;
/** 항목 이름 행 후보 미리보기로 사용자에게 보여줄 행 수. */
const HEADER_CHOICE_LIMIT = 10;

const NUMERIC_RE = /^-?[\d,]+(\.\d+)?$/;
const DATE_LIKE_RE = /^\d{2,4}[.\-/]\d{1,2}([.\-/]\d{1,2})?\.?$/;

function cellText(row: unknown[] | undefined, idx: number): string {
  const value = row?.[idx];
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function widestRow(rows: unknown[][], limit: number): number {
  let widest = 0;
  const end = Math.min(rows.length, limit);
  for (let i = 0; i < end; i++) {
    widest = Math.max(widest, rows[i]?.length ?? 0);
  }
  return widest;
}

/** 해당 행에서 값이 채워진 칸의 비율. */
function fillRatio(rows: unknown[][], rowIndex: number, width: number): number {
  if (width === 0) return 0;
  let filled = 0;
  for (let c = 0; c < width; c++) {
    if (cellText(rows[rowIndex], c) !== '') filled++;
  }
  return filled / width;
}

/**
 * 항목 이름 행일 가능성을 점수로 매긴다.
 *
 * 실제 행정 엑셀은 첫 행이 기관명·보고서 제목인 경우가 많아
 * "첫 행 = 항목 이름"으로 단정하면 데이터 값이 항목 이름으로 잡힌다.
 * 항목 이름 행은 (1) 대부분의 칸이 차 있고 (2) 값이 서로 겹치지 않으며
 * (3) 숫자·날짜가 아닌 짧은 글자이고 (4) 아래에 비슷한 폭의 데이터가 이어진다.
 */
function scoreHeaderRow(rows: unknown[][], rowIndex: number, width: number): number {
  const values: string[] = [];
  for (let c = 0; c < width; c++) {
    const text = cellText(rows[rowIndex], c);
    if (text !== '') values.push(text);
  }
  if (values.length === 0) return Number.NEGATIVE_INFINITY;

  // 병합된 제목 행은 칸 하나만 차 있다.
  if (width >= 3 && values.length === 1) return Number.NEGATIVE_INFINITY;

  const filled = values.length / width;
  const unique = new Set(values).size / values.length;
  const text = values.filter((v) => !NUMERIC_RE.test(v) && !DATE_LIKE_RE.test(v)).length / values.length;
  const short = values.filter((v) => v.length <= 30).length / values.length;

  let below = 0;
  let belowRows = 0;
  for (let r = rowIndex + 1; r < Math.min(rows.length, rowIndex + 6); r++) {
    below += fillRatio(rows, r, width);
    belowRows++;
  }
  const belowFill = belowRows > 0 ? below / belowRows : 0;

  return (
    filled * 3 +
    unique * 2.5 +
    text * 2 +
    short * 1 +
    belowFill * 2 -
    rowIndex * 0.15 // 조건이 비슷하면 위쪽 행을 택한다.
  );
}

function detectHeaderRow(rows: unknown[][]): number {
  const width = widestRow(rows, 50);
  if (width === 0) return 0;

  let best = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  const scanEnd = Math.min(rows.length, HEADER_SCAN_LIMIT);
  for (let r = 0; r < scanEnd; r++) {
    const score = scoreHeaderRow(rows, r, width);
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

/** 같은 이름의 항목이 여러 개면 뒤쪽 값이 사라지므로 번호를 붙여 구분한다. */
function buildHeaders(rows: unknown[][], headerRowIndex: number, width: number) {
  const used = new Map<string, number>();
  const headers: Array<{ name: string; idx: number }> = [];

  for (let c = 0; c < width; c++) {
    const raw = cellText(rows[headerRowIndex], c);
    if (raw === '') continue;
    const seen = used.get(raw) ?? 0;
    used.set(raw, seen + 1);
    headers.push({ name: seen === 0 ? raw : `${raw} (${seen + 1})`, idx: c });
  }
  return headers;
}

function summarizeSheets(wb: XLSX.WorkBook): SheetSummary[] {
  return wb.SheetNames.map((name: string) => {
    const ws = wb.Sheets[name];
    const ref = ws?.['!ref'];
    if (!ref) return { name, rows: 0, cols: 0, hasData: false };
    const range = XLSX.utils.decode_range(ref);
    const rows = range.e.r - range.s.r + 1;
    const cols = range.e.c - range.s.c + 1;
    return { name, rows, cols, hasData: rows >= 3 && cols >= 2 };
  });
}

/** 안내·표지 시트를 피하고 실제 데이터가 가장 많은 시트를 고른다. */
function pickSheet(summaries: SheetSummary[]): string {
  const withData = summaries.filter((s) => s.hasData);
  const pool = withData.length > 0 ? withData : summaries;
  let best = pool[0];
  for (const s of pool) {
    if (s.rows > best.rows) best = s;
  }
  return best?.name ?? summaries[0]?.name ?? '';
}

function loadSheet(sheetName: string, forcedHeaderRow?: number) {
  const wb = storedWorkbook;
  if (!wb) throw new Error('먼저 파일을 선택해 주세요.');

  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`'${sheetName}' 시트를 찾을 수 없습니다.`);

  // 먼저 지역 변수로만 읽는다. 도중에 실패해도 이전에 잘 읽어둔 시트 상태가 망가지지 않아야
  // 사용자가 파일을 다시 올리지 않고 다른 시트를 고를 수 있다.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  if (rows.length === 0) throw new Error('이 시트에는 데이터가 없습니다.');

  const width = widestRow(rows, 50);
  const detected = detectHeaderRow(rows);
  const headerRowIndex =
    forcedHeaderRow !== undefined && forcedHeaderRow >= 0 && forcedHeaderRow < rows.length
      ? forcedHeaderRow
      : detected;

  const headers = buildHeaders(rows, headerRowIndex, width);
  if (headers.length === 0)
    throw new Error(
      '항목 이름을 찾을 수 없습니다. 고급 설정에서 항목 이름이 적힌 줄을 직접 골라 주세요.',
    );

  // 여기까지 왔으면 안전하므로 확정한다.
  storedSheetName = sheetName;
  storedRows = rows;
  storedHeaders = headers;
  storedDataRows = rows.slice(headerRowIndex + 1);

  const columns = storedHeaders.map((h) => h.name);
  const previewRows = storedDataRows.slice(0, 10).map((row) =>
    Object.fromEntries(storedHeaders.map(({ name, idx }) => [name, cellText(row as unknown[], idx)])),
  );

  // 고급 설정에서 "항목 이름이 적힌 행"을 직접 고를 수 있도록 앞부분 행을 함께 전달한다.
  const headerChoices = storedRows.slice(0, HEADER_CHOICE_LIMIT).map((row, i) => ({
    index: i,
    cells: Array.from({ length: Math.min(width, 8) }, (_, c) => cellText(row as unknown[], c)),
  }));

  self.postMessage({
    type: 'parse-done',
    sheetName,
    sheets: summarizeSheets(wb),
    headerRowIndex,
    headerAutoDetected: forcedHeaderRow === undefined,
    headerChoices,
    columns,
    previewRows,
    totalRows: storedDataRows.length,
  });
}

function handleParse(buffer: ArrayBuffer) {
  const wb = XLSX.read(buffer, { type: 'array' });
  if (wb.SheetNames.length === 0) throw new Error('시트를 찾을 수 없습니다.');
  storedWorkbook = wb;
  loadSheet(pickSheet(summarizeSheets(wb)));
}

function handleValidate(checks: WorkerChecks) {
  const dataRows = storedDataRows;
  const total = dataRows.length;

  const missingSet = new Set(checks.missingColumns);
  const missingByColumn: Record<string, number> = {};
  for (const col of checks.missingColumns) missingByColumn[col] = 0;

  const dupSet = new Set(checks.duplicateColumns);
  const dupHeadersMeta = storedHeaders.filter((h) => dupSet.has(h.name));
  const colFreqs: Map<string, number>[] = dupHeadersMeta.map(() => new Map());

  const listHeadersMeta = checks.listColumns
    .map((colName) => {
      const h = storedHeaders.find((s) => s.name === colName);
      return h ? { colName, idx: h.idx } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const listUniques: Map<string, Set<string>> = new Map();
  for (const { colName } of listHeadersMeta) listUniques.set(colName, new Set());

  // 완료 화면의 "확인 필요 n건"을 행 단위로 세기 위한 표시.
  // 값이 비어 있는 행만 센다. 읍면동·품목처럼 같은 값이 반복되는 항목은
  // 중복이 정상이므로 중복 건수는 항목별 표에만 남기고 행 단위 집계에는 넣지 않는다.
  const flagged = new Uint8Array(total);

  const CHUNK = 50_000;

  for (let i = 0; i < total; i += CHUNK) {
    const end = Math.min(i + CHUNK, total);

    for (let j = i; j < end; j++) {
      const arr = dataRows[j] as unknown[];

      for (const { name, idx } of storedHeaders) {
        if (missingSet.has(name) && String(arr[idx] ?? '').trim() === '') {
          missingByColumn[name]++;
          flagged[j] = 1;
        }
      }

      for (let k = 0; k < dupHeadersMeta.length; k++) {
        const val = String(arr[dupHeadersMeta[k].idx] ?? '');
        const freq = colFreqs[k];
        freq.set(val, (freq.get(val) ?? 0) + 1);
      }

      for (const { colName, idx } of listHeadersMeta) {
        const val = String(arr[idx] ?? '').trim();
        if (val) listUniques.get(colName)!.add(val);
      }
    }

    self.postMessage({ type: 'validate-progress', progress: Math.round((end / total) * 100) });
  }

  const duplicateByColumn: Record<string, number> = {};
  for (let k = 0; k < dupHeadersMeta.length; k++) {
    let dupCount = 0;
    for (const cnt of colFreqs[k].values()) {
      if (cnt > 1) dupCount += cnt;
    }
    duplicateByColumn[dupHeadersMeta[k].name] = dupCount;
  }

  let issueRows = 0;
  for (let j = 0; j < total; j++) {
    if (flagged[j]) issueRows++;
  }

  const listByColumn: Record<string, number> = {};
  for (const [colName, uniqSet] of listUniques) {
    listByColumn[colName] = uniqSet.size;
  }

  self.postMessage({
    type: 'validate-done',
    totalRows: total,
    issueRows,
    missingByColumn: checks.missingColumns.length > 0 ? missingByColumn : null,
    duplicateByColumn: checks.duplicateColumns.length > 0 ? duplicateByColumn : null,
    listByColumn: listHeadersMeta.length > 0 ? listByColumn : null,
  });
}

function handleGetAll() {
  const CHUNK = 20_000;
  const dataRows = storedDataRows;
  const total = dataRows.length;

  for (let i = 0; i < total; i += CHUNK) {
    const end = Math.min(i + CHUNK, total);
    const chunk: Record<string, string>[] = [];
    for (let j = i; j < end; j++) {
      const arr = dataRows[j] as unknown[];
      chunk.push(
        Object.fromEntries(
          storedHeaders.map(({ name, idx }) => [name, String(arr[idx] ?? '')]),
        ),
      );
    }
    self.postMessage({ type: 'all-data-chunk', chunk, offset: i, total });
  }
  self.postMessage({ type: 'all-data-done', total });
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as {
    type: string;
    buffer?: ArrayBuffer;
    checks?: WorkerChecks;
    sheetName?: string;
    headerRowIndex?: number;
  };
  try {
    if (msg.type === 'parse' && msg.buffer) handleParse(msg.buffer);
    else if (msg.type === 'select-sheet' && msg.sheetName) loadSheet(msg.sheetName);
    else if (msg.type === 'set-header-row' && msg.headerRowIndex !== undefined)
      loadSheet(storedSheetName, msg.headerRowIndex);
    else if (msg.type === 'validate' && msg.checks) handleValidate(msg.checks);
    else if (msg.type === 'get-all') handleGetAll();
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.',
    });
  }
};
