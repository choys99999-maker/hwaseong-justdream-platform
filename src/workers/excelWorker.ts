/// <reference lib="webworker" />
import * as XLSX from 'xlsx';

interface SelectedChecks {
  missing: boolean;
  duplicate: boolean;
  error: boolean;
}

// 파싱된 행을 워커 메모리에 보관 (validate 요청 때 재사용)
let storedRows: unknown[][] = [];
let storedHeaders: Array<{ name: string; idx: number }> = [];

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
    columns: storedHeaders.map((h) => h.name),
    previewRows,
    totalRows: storedRows.length - 1,
  });
}

function handleValidate(checks: SelectedChecks) {
  const dataRows = storedRows.slice(1);
  const total = dataRows.length;

  let missingRows = 0;
  let duplicateRows = 0;
  let errorRows = 0;

  // 중복 검사: 이름/성명 컬럼이 있으면 그것만, 없으면 전체 행 해시
  const keyColIdx = (() => {
    const patterns = ['이름', '성명', '이용자', '수혜자', '수급자'];
    for (const { name, idx } of storedHeaders) {
      if (patterns.some((p) => name.includes(p))) return idx;
    }
    return -1;
  })();

  const seenSet = new Set<string>();
  const CHUNK = 50_000;

  for (let i = 0; i < total; i += CHUNK) {
    const end = Math.min(i + CHUNK, total);

    for (let j = i; j < end; j++) {
      const arr = dataRows[j] as unknown[];

      if (checks.missing) {
        if (arr.some((cell) => String(cell).trim() === '')) missingRows++;
      }

      if (checks.duplicate) {
        const key =
          keyColIdx >= 0
            ? String(arr[keyColIdx] ?? '')
            : arr.slice(0, storedHeaders.length).map((c) => String(c)).join('\x00');
        if (seenSet.has(key)) duplicateRows++;
        else seenSet.add(key);
      }

      if (checks.error) {
        let hasError = false;
        for (let ci = 0; ci < storedHeaders.length; ci++) {
          const { name: col, idx } = storedHeaders[ci];
          const val = String(arr[idx] ?? '');
          if (!val) continue;
          if (
            (col.includes('일') || col.includes('날짜')) &&
            !/^\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(val)
          ) {
            hasError = true;
            break;
          }
          if (
            (col.includes('연락처') || col.includes('전화') || col.includes('번호')) &&
            !/^[\d\s\-+().]{7,20}$/.test(val)
          ) {
            hasError = true;
            break;
          }
        }
        if (hasError) errorRows++;
      }
    }

    self.postMessage({
      type: 'validate-progress',
      progress: Math.round((end / total) * 100),
    });
  }

  self.postMessage({
    type: 'validate-done',
    totalRows: total,
    missingRows: checks.missing ? missingRows : null,
    duplicateRows: checks.duplicate ? duplicateRows : null,
    errorRows: checks.error ? errorRows : null,
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
