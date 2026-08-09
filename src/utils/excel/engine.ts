// 엑셀 해석 엔진 v2 — 조립.
//
//   엑셀 파일 → 시트 탐색 → 헤더 자동 탐지 → 시트 내용 판별 → 컬럼 의미 자동 매핑
//   → 값 정규화 → 합계/빈 행/병합 처리 → 오류 및 미인식 탐지 → 표준 JSON
//
// 최종 출력(MappedRecord)의 키는 DB의 create_submission RPC가 그대로 받는 camelCase다.
// 여기서 새 필드를 만들면 RPC가 조용히 버리므로 만들지 않는다.
import * as XLSX from 'xlsx';
import type {
  ColumnDiagnosis,
  MappedRecord,
  PlatformColumnKey,
  SheetConvertResult,
  SheetParseResult,
  SkippedRow,
  TotalsCheck,
  ValidationError,
} from '../../types/upload';
import { AUTO_THRESHOLD, matchIgnored } from './match';
import { DATE_FIELDS, fieldLabel, getColumnsForType, NON_NEGATIVE_FIELDS, NUMBER_FIELDS } from './schema';
import {
  appendHeaderlessColumns,
  classifyRow,
  isGrandTotalLabel,
  classifySheet,
  collectTitleLines,
  detectCumulative,
  detectHeader,
  detectRegion,
  detectWeekly,
  isRowEmpty,
  pickLabelColumns,
  readSheetMatrix,
  suggestForColumn,
  type HeaderColumn,
  type SheetMatrix,
} from './sheet';
import { cellAddress, colLetter, normalizeSpace, toText } from './text';
import { parseBirthDateValue, parseDateValue, parseNumberValue, parseTextValue } from './values';

/** 확인 화면에 붙이는 원본 미리보기 줄 수. */
const PREVIEW_ROWS = 10;

export interface AnalyzedSheet {
  result: SheetParseResult;
  matrix: SheetMatrix;
  columns: HeaderColumn[];
  /** 0-based. 데이터가 시작하는 행. */
  dataStartIndex: number;
}

// ── 분석 ──────────────────────────────────────────────────

function buildDiagnostics(
  columns: HeaderColumn[],
  type: SheetParseResult['sheetType'],
): ColumnDiagnosis[] {
  interface Draft extends ColumnDiagnosis {
    matchedAlias: string;
  }

  const drafts: Draft[] = columns.map((col) => {
    const ignoredReason = matchIgnored(col.candidates);
    if (ignoredReason) {
      return {
        index: col.index,
        letter: colLetter(col.index),
        name: col.name,
        rawName: col.rawName,
        mapped: null,
        confidence: 1,
        status: 'ignored' as const,
        reason: ignoredReason,
        matchedAlias: '',
      };
    }

    if (col.candidates.length === 0) {
      return {
        index: col.index,
        letter: colLetter(col.index),
        name: col.name,
        rawName: col.rawName,
        mapped: null,
        confidence: 0,
        status: 'unmapped' as const,
        reason: '머리글이 비어 있어 무슨 열인지 알 수 없습니다. 값은 들어 있습니다.',
        matchedAlias: '',
      };
    }

    const match = suggestForColumn(col, type);
    if (!match) {
      return {
        index: col.index,
        letter: colLetter(col.index),
        name: col.name,
        rawName: col.rawName,
        mapped: null,
        confidence: 0,
        status: 'unmapped' as const,
        reason: '표준 항목 중 맞는 것을 찾지 못했습니다',
        matchedAlias: '',
      };
    }

    return {
      index: col.index,
      letter: colLetter(col.index),
      name: col.name,
      rawName: col.rawName,
      mapped: match.key,
      confidence: match.confidence,
      status: match.confidence >= AUTO_THRESHOLD ? ('auto' as const) : ('suggested' as const),
      reason: match.reason,
      matchedAlias: match.matchedAlias,
    };
  });

  // 같은 표준 항목에 여러 열이 걸리면 가장 잘 맞는 하나만 남긴다.
  // 나머지는 조용히 버리지 않고 'duplicate'로 표시해 사용자에게 넘긴다.
  const bestByKey = new Map<PlatformColumnKey, Draft>();
  for (const draft of drafts) {
    if (!draft.mapped) continue;
    const prev = bestByKey.get(draft.mapped);
    if (!prev || draft.confidence > prev.confidence) bestByKey.set(draft.mapped, draft);
  }
  for (const draft of drafts) {
    if (!draft.mapped) continue;
    const winner = bestByKey.get(draft.mapped);
    if (winner && winner !== draft) {
      draft.reason = `"${winner.name}" 열이 ${fieldLabel(draft.mapped)}에 더 잘 맞습니다. 어느 쪽을 쓸지 확인해 주세요.`;
      draft.status = 'duplicate';
      draft.mapped = null;
    }
  }

  return drafts.map(({ matchedAlias: _alias, ...rest }) => rest);
}

function buildPreviewRows(
  matrix: SheetMatrix,
  columns: HeaderColumn[],
  dataStartIndex: number,
): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  for (let r = dataStartIndex; r < matrix.rowCount && rows.length < PREVIEW_ROWS; r++) {
    const row = matrix.rows[r];
    if (isRowEmpty(row)) continue;
    rows.push(
      Object.fromEntries(columns.map((col) => [col.name, toText(row[col.index]).trim()])),
    );
  }
  return rows;
}

function countFilledRows(matrix: SheetMatrix, dataStartIndex: number): number {
  let count = 0;
  for (let r = dataStartIndex; r < matrix.rowCount; r++) {
    if (!isRowEmpty(matrix.rows[r])) count++;
  }
  return count;
}

function analyzeSheet(sheetName: string, ws: XLSX.WorkSheet): AnalyzedSheet {
  const matrix = readSheetMatrix(ws);
  const detection = detectHeader(matrix);
  const classification = classifySheet(sheetName, detection);
  const notes = [...classification.notes];

  if (!detection) {
    const cumulativeNoHeader = detectCumulative(sheetName, []);
    const result: SheetParseResult = {
      sheetName,
      sheetType: classification.type,
      role: classification.role,
      isCumulative: cumulativeNoHeader,
      isWeekly: detectWeekly(sheetName, cumulativeNoHeader),
      columns: [],
      previewRows: [],
      totalRows: 0,
      headerRow: 0,
      headerRowCount: 0,
      dataStartRow: 0,
      titleLines: [],
      detectedRegion: null,
      columnDiagnostics: [],
      typeConfidence: 0,
      notes,
    };
    return { result, matrix, columns: [], dataStartIndex: matrix.rowCount };
  }

  const dataStartIndex = detection.startRow + detection.rowCount;
  // 머리글이 비었어도 값이 있는 열은 살려 둔다. 이름 없는 열이 조용히 사라지지 않도록.
  const columns = appendHeaderlessColumns(matrix, detection.columns, dataStartIndex);
  const titleLines = collectTitleLines(matrix, detection.startRow);
  const detectedRegion = detectRegion(titleLines, sheetName);
  const diagnostics = buildDiagnostics(columns, classification.type);
  const isCumulative = detectCumulative(sheetName, columns.map((c) => c.rawName));

  if (detection.rowCount > 1) {
    notes.push(`머리글이 ${detection.rowCount}줄로 병합되어 있어 합쳐서 읽었습니다.`);
  }
  if (titleLines.length > 0) {
    notes.push(`표 위 제목 ${titleLines.length}줄은 자료에서 제외했습니다.`);
  }

  const result: SheetParseResult = {
    sheetName,
    sheetType: classification.type,
    role: classification.role,
    isCumulative: isCumulative,
    isWeekly: detectWeekly(sheetName, isCumulative),
    columns: columns.map((c) => c.name),
    previewRows: buildPreviewRows(matrix, columns, dataStartIndex),
    totalRows: countFilledRows(matrix, dataStartIndex),
    headerRow: detection.startRow + 1,
    headerRowCount: detection.rowCount,
    dataStartRow: dataStartIndex + 1,
    titleLines,
    detectedRegion,
    columnDiagnostics: diagnostics,
    typeConfidence: classification.confidence,
    notes,
  };

  return { result, matrix, columns, dataStartIndex };
}

/** 엑셀 한 파일의 모든 시트를 각각 독립적으로 분석한다. */
export function analyzeWorkbook(buffer: ArrayBuffer): AnalyzedSheet[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheets = wb.SheetNames.map((name) => analyzeSheet(name, wb.Sheets[name]));

  // 한 파일에 누계와 주별이 함께 오면 그냥 더했을 때 같은 값을 두 번 센다.
  // (DB의 v_performance_rows 등이 is_cumulative = false 만 집계한다)
  const hasCumulative = sheets.some((s) => s.result.isCumulative && s.result.role === 'data');
  const hasWeekly = sheets.some((s) => !s.result.isCumulative && s.result.role === 'data');
  if (hasCumulative && hasWeekly) {
    for (const sheet of sheets) {
      if (sheet.result.isCumulative) {
        sheet.result.notes.push('주별 자료와 함께 올라와 이중 집계를 막기 위해 집계에서 제외됩니다. (자료는 그대로 저장됩니다)');
      }
    }
  } else if (hasCumulative) {
    for (const sheet of sheets) {
      if (sheet.result.isCumulative) {
        sheet.result.notes.push('누계 시트라 집계에서 제외됩니다. (자료는 그대로 저장됩니다)');
      }
    }
  }

  return sheets;
}

/** 자동 인식 결과를 UI가 쓰는 "열 이름 → 표준 항목" 표로 만든다. */
export function defaultMapping(sheet: SheetParseResult): Record<string, PlatformColumnKey | null> {
  const mapping: Record<string, PlatformColumnKey | null> = {};
  for (const diag of sheet.columnDiagnostics) mapping[diag.name] = diag.mapped;
  return mapping;
}

// ── 변환 ──────────────────────────────────────────────────

function previewOfRow(row: unknown[], columns: HeaderColumn[]): string {
  const texts = columns
    .map((col) => normalizeSpace(row[col.index]))
    .filter(Boolean)
    .slice(0, 3);
  return texts.join(' | ');
}

/** 이름 칸에 "합계/총계/총합"이 적힌 총합 행인지. (소계는 구간 합이라 제외) */
function isTotalRow(row: unknown[], labelColumnIndexes: number[]): boolean {
  for (const index of labelColumnIndexes) {
    const text = normalizeSpace(row[index]);
    if (text && text.length <= 14 && isGrandTotalLabel(text)) return true;
  }
  return false;
}

/**
 * 파일이 스스로 적어둔 합계와 우리가 읽은 값의 합을 맞춰본다.
 *
 * 정답 파일을 옆에 두고 비교하는 대신, 파일 자신에게 검산을 시키는 것이다.
 * 어긋나면 행을 빠뜨렸거나 열을 잘못 붙였다는 뜻이라 사용자에게 알려야 한다.
 * (합계 행이 없는 파일은 검산도 없다 — 없는 근거를 지어내지 않는다)
 */
function crossFootTotals(
  totalRows: Array<{ rowNumber: number; row: unknown[] }>,
  colByKey: Map<PlatformColumnKey, HeaderColumn>,
  records: MappedRecord[],
  numberFields: Set<PlatformColumnKey>,
): TotalsCheck[] {
  if (totalRows.length === 0) return [];
  // 총합 행이 여러 개면 맨 앞의 것만 본다. (구간마다 총합을 적는 양식은 드물다)
  const { rowNumber, row } = totalRows[0];

  const checks: TotalsCheck[] = [];
  for (const [key, col] of colByKey) {
    if (!numberFields.has(key)) continue;
    const declaredValue = parseNumberValue(row[col.index]);
    if (declaredValue.state !== 'ok' || declaredValue.value === null) continue;

    let computed = 0;
    let seen = false;
    for (const record of records) {
      const value = record[key];
      if (typeof value === 'number') {
        computed += value;
        seen = true;
      }
    }
    if (!seen) continue;

    checks.push({
      field: key,
      declared: declaredValue.value,
      computed,
      // 소수 합산 오차만 눈감아 준다.
      matches: Math.abs(declaredValue.value - computed) < 1e-6,
      rowNumber,
    });
  }
  return checks;
}

/**
 * 매핑에 따라 한 시트를 표준 레코드로 바꾼다.
 * 값을 읽을 수 없으면 그 칸만 비우고 오류로 남긴다. 행 전체를 조용히 버리지 않는다.
 */
export function convertSheet(
  sheet: AnalyzedSheet,
  mapping: Record<string, PlatformColumnKey | null>,
): SheetConvertResult {
  const { matrix, columns, dataStartIndex, result: parsed } = sheet;
  const type = parsed.sheetType;
  const numberFields = NUMBER_FIELDS[type];

  const records: MappedRecord[] = [];
  const errors: ValidationError[] = [];
  const grandTotalRows: Array<{ rowNumber: number; row: unknown[] }> = [];
  const sourceRowNumbers: number[] = [];
  const skippedRows: SkippedRow[] = [];
  let emptyRowCount = 0;

  /** 표준 항목 → 원본 열 */
  const colByKey = new Map<PlatformColumnKey, HeaderColumn>();
  /** 원본 열 번호 → 표준 항목 */
  const keyByIndex = new Map<number, string | null>();
  for (const col of columns) {
    const key = mapping[col.name] ?? null;
    keyByIndex.set(col.index, key);
    if (key && !colByKey.has(key)) colByKey.set(key, col);
  }

  const labelColumns = pickLabelColumns(columns, keyByIndex, type);
  const mappedColumns = columns.filter((col) => keyByIndex.get(col.index));
  const mappedColumnIndexes = mappedColumns.map((col) => col.index);

  // 지역 열이 없으면 시트 제목에서 찾은 읍면동으로 채운다. 채웠다는 사실은 화면에 보여준다.
  const needsRegionFill = type === 'generic' && !colByKey.has('region') && !!parsed.detectedRegion;
  const filledRegion = needsRegionFill ? parsed.detectedRegion : null;

  const requiredKeys = getColumnsForType(type)
    .filter((def) => def.required)
    .map((def) => def.key);
  const requiredColumnIndexes = requiredKeys
    .map((key) => colByKey.get(key)?.index)
    .filter((index): index is number => index !== undefined);

  // 1단계: 행마다 무엇인지만 먼저 정한다.
  const classified = [];
  for (let r = dataStartIndex; r < matrix.rowCount; r++) {
    classified.push({
      index: r,
      ...classifyRow(matrix.rows[r], columns, labelColumns, requiredColumnIndexes, mappedColumnIndexes),
    });
  }

  // 2단계: 표가 어디서 끝나는지 정한다.
  // 표 아래 한참 떨어진 곳에 값이 흩어져 있는 파일이 있다. 그것까지 표의 데이터로 읽으면
  // 없는 건수가 생긴다. 데이터가 아닌 줄이 연달아 나오면 표가 끝난 것으로 본다.
  // (소계·합계 줄은 표의 일부라 끊김으로 세지 않는다)
  const BREAK_RUN = 3;
  let lastDataAt = -1;
  let tableEndAt = Number.POSITIVE_INFINITY;
  let run = 0;
  for (const entry of classified) {
    if (entry.kind === 'data') {
      lastDataAt = entry.index;
      run = 0;
    } else if (entry.kind === 'aggregate') {
      run = 0;
    } else {
      run++;
      if (lastDataAt >= 0 && run >= BREAK_RUN) {
        tableEndAt = lastDataAt;
        break;
      }
    }
  }
  // 표가 끝난 뒤의 줄은 지우지 않고 "확인 대상"으로 올린다.
  for (const entry of classified) {
    if (entry.index > tableEndAt && entry.kind === 'data') {
      entry.kind = 'uncertain';
      entry.message = '표가 끝난 한참 뒤에 있는 줄이라 이 표의 데이터인지 판단할 수 없습니다';
    }
  }

  // 3단계: 데이터 행만 표준 레코드로 바꾼다.
  for (const { index: r, kind, message } of classified) {
    const row = matrix.rows[r];
    const rowNumber = r + 1;

    if (kind === 'empty') {
      emptyRowCount++;
      continue;
    }
    if (kind === 'aggregate' || kind === 'note' || kind === 'uncertain') {
      skippedRows.push({ rowNumber, kind, message, preview: previewOfRow(row, columns) });
      // 총합 행의 숫자는 나중에 우리가 읽은 값과 맞춰볼 검산 기준이 된다.
      if (kind === 'aggregate' && isTotalRow(row, labelColumns)) {
        grandTotalRows.push({ rowNumber, row });
      }
      continue;
    }

    const record: MappedRecord = {};

    for (const col of mappedColumns) {
      const key = keyByIndex.get(col.index) as PlatformColumnKey;
      const raw = row[col.index];
      const address = cellAddress(col.index, rowNumber);

      if (key === 'birthDate') {
        const parsedValue = parseBirthDateValue(raw);
        if (parsedValue.state === 'invalid') {
          errors.push({ rowIndex: rowNumber, field: key, cellAddress: address, message: parsedValue.message! });
        } else if (parsedValue.value !== null) {
          record[key] = parsedValue.value;
        }
        continue;
      }

      if (numberFields.has(key)) {
        const parsedValue = parseNumberValue(raw);
        if (parsedValue.state === 'invalid') {
          errors.push({
            rowIndex: rowNumber,
            field: key,
            cellAddress: address,
            message: `${fieldLabel(key)} ${parsedValue.message}`,
          });
        } else if (parsedValue.value !== null) {
          if (NON_NEGATIVE_FIELDS.has(key) && parsedValue.value < 0) {
            errors.push({
              rowIndex: rowNumber,
              field: key,
              cellAddress: address,
              message: `${fieldLabel(key)} 값이 음수입니다: ${parsedValue.value}`,
            });
          } else {
            record[key] = parsedValue.value;
          }
        }
        continue;
      }

      if (DATE_FIELDS.has(key)) {
        const parsedValue = parseDateValue(raw);
        if (parsedValue.state === 'invalid') {
          errors.push({
            rowIndex: rowNumber,
            field: key,
            cellAddress: address,
            message: `${fieldLabel(key)} ${parsedValue.message}`,
          });
        } else if (parsedValue.value !== null) {
          record[key] = parsedValue.value;
        }
        continue;
      }

      const parsedValue = parseTextValue(raw);
      if (parsedValue.value !== null) record[key] = parsedValue.value;
    }

    if (filledRegion) record.region = filledRegion;

    // 연결된 열에서 아무 값도 못 얻었는데 행에는 글자가 있다.
    // = 아직 연결하지 않은 열에만 값이 있다는 뜻이다. 조용히 넘기지 않는다.
    if (Object.keys(record).length === 0) {
      skippedRows.push({
        rowNumber,
        kind: 'uncertain',
        message: '연결된 열에는 값이 없고, 연결하지 않은 열에만 값이 있습니다',
        preview: previewOfRow(row, columns),
      });
      continue;
    }

    for (const key of requiredKeys) {
      const col = colByKey.get(key);
      if (!col) continue; // 열 자체가 없는 경우는 열 진단에서 이미 알린다
      if (record[key] === undefined || record[key] === '') {
        errors.push({
          rowIndex: rowNumber,
          field: key,
          cellAddress: cellAddress(col.index, rowNumber),
          message: `${fieldLabel(key)}이(가) 비어 있습니다`,
        });
      }
    }

    records.push(record);
    sourceRowNumbers.push(rowNumber);
  }

  return {
    sheetName: parsed.sheetName,
    sheetType: type,
    records,
    errors,
    sourceRowNumbers,
    skippedRows,
    emptyRowCount,
    filledRegion,
    totalsChecks: crossFootTotals(grandTotalRows, colByKey, records, numberFields),
  };
}
