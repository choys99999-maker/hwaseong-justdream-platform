/// <reference lib="webworker" />
import * as XLSX from 'xlsx';

interface SelectedChecks {
  missing: boolean;
  duplicate: boolean;
  errorColumns: string[];
}

let storedRows: unknown[][] = [];
let storedHeaders: Array<{ name: string; idx: number }> = [];

function detectColumnType(name: string): 'date' | 'phone' | 'number' | 'text' {
  if (/일$|날짜|생년/.test(name)) return 'date';
  if (/연락|전화|핸드폰/.test(name)) return 'phone';
  if (/수량|개수|금액|합계/.test(name)) return 'number';
  return 'text';
}

function handleParse(buffer: ArrayBuffer) {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('시트를 찾을 수 없습니다.');

  const ws = wb.Sheets[sheetName];
  storedRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  if (storedRows.length === 0) throw new Error('시트에 데이터가 없습니다.');

  const headerRow = storedRows[0] as unknown[];
  storedHeaders = headerRow
    .map((cell, idx) => ({ name: String(cell), idx }))
    .filter(({ name }) => name.trim() !== '');

  if (storedHeaders.length === 0)
    throw new Error('유효한 열 이름을 찾을 수 없습니다. 첫 번째 행에 열 이름이 있는지 확인하세요.');

  const columns = storedHeaders.map((h) => h.name);
  const previewRows = storedRows.slice(1, 11).map((row) => {
    const arr = row as unknown[];
    return Object.fromEntries(
      storedHeaders.map(({ name, idx }) => [name, String(arr[idx] ?? '')]),
    );
  });

  self.postMessage({
    type: 'parse-done',
    sheetName,
    sheetNames: wb.SheetNames,
    columns,
    previewRows,
    totalRows: storedRows.length - 1,
  });
}

function handleValidate(checks: SelectedChecks) {
  const dataRows = storedRows.slice(1);
  const total = dataRows.length;

  // 열별 누락 카운터
  const missingByColumn: Record<string, number> = {};
  if (checks.missing) {
    for (const { name } of storedHeaders) missingByColumn[name] = 0;
  }

  // 열별 빈도 맵 (중복 검사용)
  const colFreqs: Map<string, number>[] = checks.duplicate
    ? storedHeaders.map(() => new Map())
    : [];

  // 열별 오류 카운터
  const errorByColumn: Record<string, number> = {};
  const errorColMeta = checks.errorColumns
    .map((colName) => {
      const h = storedHeaders.find((s) => s.name === colName);
      return h ? { colName, idx: h.idx, type: detectColumnType(colName) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  for (const { colName } of errorColMeta) errorByColumn[colName] = 0;

  const CHUNK = 50_000;

  for (let i = 0; i < total; i += CHUNK) {
    const end = Math.min(i + CHUNK, total);

    for (let j = i; j < end; j++) {
      const arr = dataRows[j] as unknown[];

      // 열별 누락 (빈 셀 수)
      if (checks.missing) {
        for (let k = 0; k < storedHeaders.length; k++) {
          if (String(arr[storedHeaders[k].idx] ?? '').trim() === '')
            missingByColumn[storedHeaders[k].name]++;
        }
      }

      // 열별 빈도 누적 (중복 계산용)
      if (checks.duplicate) {
        for (let k = 0; k < storedHeaders.length; k++) {
          const val = String(arr[storedHeaders[k].idx] ?? '');
          const freq = colFreqs[k];
          freq.set(val, (freq.get(val) || 0) + 1);
        }
      }

      // 열별 형식 오류
      for (const { colName, idx, type } of errorColMeta) {
        const val = String(arr[idx] ?? '');
        if (!val) continue;
        let hasError = false;
        if (type === 'date' && !/^\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(val)) hasError = true;
        if (type === 'phone' && !/^[\d\s\-+().]{7,20}$/.test(val)) hasError = true;
        if (type === 'number' && !/^\d+(\.\d+)?$/.test(val)) hasError = true;
        if (hasError) errorByColumn[colName]++;
      }
    }

    self.postMessage({ type: 'validate-progress', progress: Math.round((end / total) * 100) });
  }

  // 빈도 맵 → 열별 중복 카운트 (값이 2회 이상 등장한 셀 합계)
  const duplicateByColumn: Record<string, number> = {};
  if (checks.duplicate) {
    for (let k = 0; k < storedHeaders.length; k++) {
      let dupCount = 0;
      for (const cnt of colFreqs[k].values()) {
        if (cnt > 1) dupCount += cnt;
      }
      duplicateByColumn[storedHeaders[k].name] = dupCount;
    }
  }

  self.postMessage({
    type: 'validate-done',
    totalRows: total,
    missingByColumn: checks.missing ? missingByColumn : null,
    duplicateByColumn: checks.duplicate ? duplicateByColumn : null,
    errorByColumn: errorColMeta.length > 0 ? errorByColumn : null,
  });
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as { type: string; buffer?: ArrayBuffer; checks?: SelectedChecks };
  try {
    if (msg.type === 'parse' && msg.buffer) handleParse(msg.buffer);
    else if (msg.type === 'validate' && msg.checks) handleValidate(msg.checks);
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.',
    });
  }
};
