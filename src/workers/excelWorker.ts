/// <reference lib="webworker" />
// 엑셀 파일을 메인 스레드 밖에서 읽는다. 해석 로직은 전부 utils/excel 에 있고
// 이 파일은 메시지를 주고받는 껍데기다. (그래서 브라우저 없이도 엔진을 테스트할 수 있다)
import type { PlatformColumnKey, RawCell, SheetConvertResult } from '../types/upload';
import { analyzeWorkbook, convertSheet, type AnalyzedSheet } from '../utils/excel/engine';
import { isRowEmpty } from '../utils/excel/sheet';

const storedSheets = new Map<string, AnalyzedSheet>();

function handleParse(buffer: ArrayBuffer) {
  const analyzed = analyzeWorkbook(buffer);
  storedSheets.clear();
  for (const sheet of analyzed) storedSheets.set(sheet.result.sheetName, sheet);

  self.postMessage({ type: 'parse-done', sheets: analyzed.map((s) => s.result) });
}

/**
 * 미리보기 전용 읽기 전용 조회.
 * 이미 parse 단계에서 읽어둔 원본 행을 요청한 구간만큼 잘라 돌려줄 뿐,
 * 값을 해석하거나 바꾸지 않는다. (변환·검증 경로와 완전히 분리)
 */
function handlePreviewRows(sheetName: string, start: number, limit: number) {
  const sheet = storedSheets.get(sheetName);
  if (!sheet) {
    self.postMessage({
      type: 'preview-rows-done',
      sheetName, start, columns: [], rows: [], rowNumbers: [], totalRows: 0,
    });
    return;
  }

  const { matrix, columns, dataStartIndex } = sheet;

  // 표 아래에 남은 빈 줄까지 보여주면 "제대로 읽혔나"를 판단하기 어렵다. 빈 줄은 건너뛴다.
  const filled: number[] = [];
  for (let r = dataStartIndex; r < matrix.rowCount; r++) {
    if (!isRowEmpty(matrix.rows[r])) filled.push(r);
  }

  const slice = filled.slice(start, start + limit);
  const rows: RawCell[][] = slice.map((rowIndex) => {
    const row = matrix.rows[rowIndex];
    return columns.map(({ index }) => {
      const v = row[index];
      if (v === null || v === undefined) return '';
      if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v;
      return String(v);
    });
  });

  self.postMessage({
    type: 'preview-rows-done',
    sheetName,
    start,
    columns: columns.map((c) => c.name),
    rows,
    rowNumbers: slice.map((r) => r + 1),
    totalRows: filled.length,
  });
}

function handleConvert(sheetMappings: Record<string, Record<string, PlatformColumnKey | null>>) {
  const results: SheetConvertResult[] = [];
  for (const [sheetName, mapping] of Object.entries(sheetMappings)) {
    const sheet = storedSheets.get(sheetName);
    if (!sheet) continue;
    results.push(convertSheet(sheet, mapping));
  }
  self.postMessage({ type: 'convert-done', sheets: results });
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as {
    type: string;
    buffer?: ArrayBuffer;
    sheetMappings?: Record<string, Record<string, PlatformColumnKey | null>>;
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
