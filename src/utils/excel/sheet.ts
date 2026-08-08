// 엑셀 해석 엔진 v2 — 시트 읽기 / 헤더 탐지 / 시트 판별 / 행 분류.
//
// 여기서 하는 일은 "어디부터 표인가"와 "이 표가 무슨 자료인가"를 정하는 것이다.
// 행 수를 하드코딩하지 않고, 시트 이름을 믿지 않고, 내용으로만 판단한다.
import * as XLSX from 'xlsx';
import type { SheetRole, SheetType } from '../../types/upload';
import { extractEupMyeonDong } from '../address';
import { matchColumn, scoreHeadersForType, SUGGEST_THRESHOLD } from './match';
import { NUMBER_FIELDS, SHEET_TYPES } from './schema';
import {
  hasKorean,
  headerKeyLoose,
  looksLikeDateHeader,
  looksNumeric,
  normalizeSpace,
  toText,
} from './text';

// ── 시트 → 행렬 ───────────────────────────────────────────

export interface SheetMatrix {
  /** 직사각형으로 맞춘 원본 셀 값 */
  rows: unknown[][];
  rowCount: number;
  colCount: number;
  /** 병합 셀에서 값을 받아온 자리인지. (원본에는 비어 있던 칸) */
  filledFromMerge: boolean[][];
}

/**
 * 병합 셀을 펼쳐서 읽는다.
 * 엑셀은 병합 영역의 값을 왼쪽 위 한 칸에만 저장한다. 그대로 읽으면
 *  - 가로 병합된 다중 헤더의 이름이 사라지고
 *  - 세로 병합된 지역/기관 칸이 첫 행에만 남는다.
 * '!merges'는 추측이 아니라 파일에 적힌 사실이므로, 이 정보로만 값을 채운다.
 * (빈칸을 "위와 같음"으로 넘겨짚는 일은 하지 않는다)
 */
export function readSheetMatrix(ws: XLSX.WorkSheet): SheetMatrix {
  const parsed = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    raw: true,
    blankrows: true,
  });

  let rowCount = parsed.length;
  let colCount = 0;
  for (const row of parsed) colCount = Math.max(colCount, row.length);

  const ref = ws['!ref'];
  if (ref) {
    try {
      const range = XLSX.utils.decode_range(ref);
      rowCount = Math.max(rowCount, range.e.r + 1);
      colCount = Math.max(colCount, range.e.c + 1);
    } catch {
      // !ref 가 깨진 파일은 sheet_to_json 결과만 쓴다.
    }
  }

  const rows: unknown[][] = [];
  const filledFromMerge: boolean[][] = [];
  for (let r = 0; r < rowCount; r++) {
    const src = parsed[r] ?? [];
    const row: unknown[] = new Array(colCount);
    const flags: boolean[] = new Array(colCount);
    for (let c = 0; c < colCount; c++) {
      row[c] = src[c] ?? '';
      flags[c] = false;
    }
    rows.push(row);
    filledFromMerge.push(flags);
  }

  for (const merge of ws['!merges'] ?? []) {
    const value = rows[merge.s.r]?.[merge.s.c];
    if (value === undefined || toText(value).trim() === '') continue;
    for (let r = merge.s.r; r <= merge.e.r && r < rowCount; r++) {
      for (let c = merge.s.c; c <= merge.e.c && c < colCount; c++) {
        if (r === merge.s.r && c === merge.s.c) continue;
        if (toText(rows[r][c]).trim() !== '') continue;
        rows[r][c] = value;
        filledFromMerge[r][c] = true;
      }
    }
  }

  return { rows, rowCount, colCount, filledFromMerge };
}

export function isRowEmpty(row: unknown[]): boolean {
  return row.every((cell) => toText(cell).trim() === '');
}

function nonEmptyIndexes(row: unknown[], indexes: number[]): number[] {
  return indexes.filter((i) => toText(row[i]).trim() !== '');
}

// ── 헤더 탐지 ─────────────────────────────────────────────

/** 헤더는 시트 위쪽에 있다. 이보다 아래까지 뒤지면 데이터 행을 헤더로 오인한다. */
const MAX_HEADER_SCAN_ROWS = 10;
/** 병합된 다중 헤더는 실무상 3줄을 넘지 않는다. */
const MAX_HEADER_ROWS = 3;

export interface HeaderColumn {
  index: number;
  /** 엑셀에 적힌 이름을 다듬은 것 (번호 붙이기 전) */
  rawName: string;
  /** 매핑·미리보기의 키. 같은 이름이 겹치면 뒤에 번호가 붙는다. */
  name: string;
  /** 매칭에 쓸 후보 문자열들. 병합 헤더의 각 줄과 이어붙인 이름을 모두 담는다. */
  candidates: string[];
}

export interface HeaderDetection {
  /** 0-based */
  startRow: number;
  rowCount: number;
  columns: HeaderColumn[];
  bestType: SheetType;
  typeScores: Record<SheetType, number>;
  score: number;
}

/**
 * 병합 헤더 여러 줄을 열 이름 하나로 합친다.
 * 아래쪽(잎) 이름이 더 구체적이라 뒤에서부터 찾는다. 날짜 머리글은 이름으로 쓰지 않는다.
 */
export function buildFlatColName(cells: string[]): string {
  const normalized = cells.map((c) => normalizeSpace(c));

  for (let i = normalized.length - 1; i >= 0; i--) {
    const s = normalized[i];
    if (s && hasKorean(s) && !looksLikeDateHeader(s)) return s;
  }
  for (let i = normalized.length - 1; i >= 0; i--) {
    const s = normalized[i];
    if (s && !looksLikeDateHeader(s)) return s;
  }
  for (let i = normalized.length - 1; i >= 0; i--) {
    if (normalized[i]) return normalized[i];
  }
  return '';
}

function buildColumns(matrix: SheetMatrix, startRow: number, rowCount: number): HeaderColumn[] {
  const columns: HeaderColumn[] = [];
  const usedNames = new Map<string, number>();

  for (let c = 0; c < matrix.colCount; c++) {
    const cells: string[] = [];
    for (let r = startRow; r < startRow + rowCount; r++) {
      cells.push(normalizeSpace(matrix.rows[r]?.[c]));
    }

    const rawName = buildFlatColName(cells);
    if (!rawName) continue;

    // 병합 헤더는 어느 줄이 진짜 의미인지 미리 알 수 없다. 전부 후보로 넣는다.
    const parts = cells.filter(Boolean);
    const candidates = [rawName, ...parts, parts.join(''), parts.join(' ')].filter(Boolean);

    const seen = usedNames.get(rawName) ?? 0;
    usedNames.set(rawName, seen + 1);
    columns.push({
      index: c,
      rawName,
      // 같은 이름의 열이 둘 이상이면 뒤쪽이 앞쪽을 덮어써 값이 통째로 사라진다.
      // (이름이 매핑·미리보기의 키라서) 번호를 붙여 구분한다.
      name: seen === 0 ? rawName : `${rawName} (${seen + 1})`,
      candidates,
    });
  }

  return columns;
}

/** 마지막 헤더 줄이 사실은 데이터 행이 아닌지. 숫자가 많으면 데이터다. */
function looksLikeDataRow(matrix: SheetMatrix, rowIndex: number): boolean {
  const row = matrix.rows[rowIndex] ?? [];
  let filled = 0;
  let numeric = 0;
  for (const cell of row) {
    if (toText(cell).trim() === '') continue;
    filled++;
    if (looksNumeric(cell)) numeric++;
  }
  if (filled < 2) return false;
  return numeric / filled > 0.4;
}

function firstDataRowIndex(matrix: SheetMatrix, from: number): number {
  for (let r = from; r < matrix.rowCount; r++) {
    if (!isRowEmpty(matrix.rows[r])) return r;
  }
  return -1;
}

/**
 * 상위 10행을 훑어 "표준 컬럼과 가장 많이 맞는 행(또는 연속된 여러 행)"을 헤더로 정한다.
 * 제목·설명·공백이 0~3행 있어도, 병합된 2~3줄 헤더여도 같은 방법으로 찾는다.
 */
export function detectHeader(matrix: SheetMatrix): HeaderDetection | null {
  let best: HeaderDetection | null = null;
  const scanLimit = Math.min(MAX_HEADER_SCAN_ROWS, matrix.rowCount);

  for (let start = 0; start < scanLimit; start++) {
    if (isRowEmpty(matrix.rows[start])) continue;

    for (let span = 1; span <= MAX_HEADER_ROWS && start + span <= matrix.rowCount; span++) {
      const lastRow = start + span - 1;
      // 헤더 마지막 줄이 데이터처럼 생겼으면 이 후보는 버린다.
      if (looksLikeDataRow(matrix, lastRow)) continue;

      const columns = buildColumns(matrix, start, span);
      if (columns.length < 2) continue;

      const candidates = columns.map((col) => col.candidates);
      const typeScores = {} as Record<SheetType, number>;
      let topType: SheetType = 'generic';
      let topScore = -1;
      for (const type of SHEET_TYPES) {
        const score = scoreHeadersForType(candidates, type);
        typeScores[type] = score;
        if (score > topScore) {
          topScore = score;
          topType = type;
        }
      }
      if (topScore <= 0) continue;

      // 데이터가 한 줄도 없으면 표라고 보기 어렵다. (안내 시트의 목차 등)
      const hasData = firstDataRowIndex(matrix, start + span) !== -1;

      let score = topScore;
      score -= 0.3 * (span - 1); // 같은 점수면 짧은 헤더를 택한다
      score -= 0.03 * start; // 같은 점수면 위쪽을 택한다
      if (!hasData) score -= 1.5;

      if (!best || score > best.score) {
        best = { startRow: start, rowCount: span, columns, bestType: topType, typeScores, score };
      }
    }
  }

  return best;
}

// ── 시트 판별 ─────────────────────────────────────────────

/** 안내·설명 시트로 보이는 이름. 판정의 근거가 아니라 마지막 보조 신호로만 쓴다. */
const GUIDE_NAME = /안내|설명|사용법|가이드|읽어|주의|목차|표지|서식|양식샘플|예시/;

/** 시트 이름 힌트. 내용 점수가 거의 같을 때만 저울을 기울인다. */
function nameHint(sheetName: string): SheetType | null {
  const n = headerKeyLoose(sheetName);
  if (/주별|주간|실적|누계|보고/.test(n)) return 'performance';
  if (/의뢰|연계|대상자|명단|상담/.test(n)) return 'referral';
  if (/물품|재고|배분|품목|나눔|후원/.test(n)) return 'generic';
  return null;
}

export interface SheetClassification {
  type: SheetType;
  role: SheetRole;
  confidence: number;
  notes: string[];
}

/** 내용(헤더)으로 유형을 정한다. 시트 이름은 동점일 때만 쓴다. */
export function classifySheet(
  sheetName: string,
  detection: HeaderDetection | null,
): SheetClassification {
  const notes: string[] = [];

  if (!detection) {
    const guide = GUIDE_NAME.test(sheetName);
    return {
      type: 'generic',
      role: guide ? 'guide' : 'unknown',
      confidence: 0,
      notes: [guide ? '표가 없어 안내 시트로 봅니다.' : '표(머리글)를 찾지 못했습니다.'],
    };
  }

  const scores = { ...detection.typeScores };
  const hint = nameHint(sheetName);
  const sorted = SHEET_TYPES.map((t) => ({ type: t, score: scores[t] })).sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const second = sorted[1];

  let type = top.type;
  // 시트 이름은 참고 정보다. 내용 점수 차가 0.5 미만일 때만 저울추가 된다.
  if (hint && hint !== top.type && top.score - second.score < 0.5 && scores[hint] >= second.score) {
    type = hint;
    notes.push(`내용만으로는 유형이 비슷해 시트 이름("${sheetName}")을 참고했습니다.`);
  }

  const topScore = scores[type];
  // 확신도: 1등이 2등보다 얼마나 확실한가 + 얼마나 많이 맞았는가
  const separation = topScore <= 0 ? 0 : (topScore - second.score) / topScore;
  const coverage = Math.min(1, topScore / 3);
  const confidence = Math.max(0, Math.min(1, 0.5 * separation + 0.5 * coverage));

  // 표는 찾았지만 표준 항목이 거의 안 맞으면 단정하지 않는다.
  const role: SheetRole = topScore < 1.5 ? 'unknown' : 'data';
  if (role === 'unknown') {
    notes.push('표는 찾았지만 어떤 자료인지 확정하지 못했습니다. 열 연결을 확인해 주세요.');
  }

  return { type, role, confidence, notes };
}

/**
 * 누계 시트 판정.
 * DB(create_submission)는 시트 이름에 '누계'가 들어가면 누계로 본다. 그 규칙을 그대로 지키고,
 * 이름에 안 드러나는 경우를 위해 '누적'과 머리글의 누계 표시를 추가로 본다.
 */
export function detectCumulative(sheetName: string, columnNames: string[]): boolean {
  const name = headerKeyLoose(sheetName);
  if (name.includes('누계') || name.includes('누적')) return true;
  return columnNames.some((col) => {
    const key = headerKeyLoose(col);
    return key === '누계' || key === '누적' || key.endsWith('누계');
  });
}

export function detectWeekly(sheetName: string): boolean {
  return /주별|주간|\d+\s*주\s*차?|주차/.test(sheetName);
}

/** 헤더 위 제목 줄. 열이 1~2칸만 찬 행을 제목/설명으로 본다. */
export function collectTitleLines(matrix: SheetMatrix, headerStartRow: number): string[] {
  const lines: string[] = [];
  for (let r = 0; r < headerStartRow; r++) {
    const row = matrix.rows[r] ?? [];
    const texts = row.map((c) => normalizeSpace(c)).filter(Boolean);
    if (texts.length === 0 || texts.length > 2) continue;
    // 가로 병합된 제목은 같은 값이 여러 칸에 채워져 있다. 중복은 하나로.
    const uniq = Array.from(new Set(texts));
    lines.push(uniq.join(' '));
  }
  return lines;
}

/** 제목 줄·시트 이름에서 읍면동을 찾는다. 지역 열이 없을 때 채움값 후보가 된다. */
export function detectRegion(titleLines: string[], sheetName: string): string | null {
  for (const line of [...titleLines, sheetName]) {
    const found = extractEupMyeonDong(line);
    if (found) return found;
  }
  return null;
}

// ── 행 분류 ───────────────────────────────────────────────

export type RowKind = 'data' | 'empty' | 'aggregate' | 'note' | 'uncertain';

export interface RowClassification {
  kind: RowKind;
  message: string;
}

/** 집계 행 이름. 정규화 후 비교한다. */
const AGGREGATE_EXACT = new Set([
  '합계', '총계', '소계', '중계', '누계', '계', '총합', '총합계', '전체합계', '누계합계',
  'total', 'sum', 'subtotal', 'grandtotal',
]);
const AGGREGATE_SUFFIX = /(합계|총계|소계|누계|총합)$/;
/** 각주·설명 행 표시. */
const NOTE_PREFIX = /^(※|＊|\*|주\)|주의|참고|비고|안내|◎|▶|-\s*※)/;
/** 구역 제목 행 표시. "[식품류]", "■ 생필품" 처럼 표 중간에 끼는 소제목. */
const SECTION_PREFIX = /^[[〈<【■●○◆▣◇□]/;

/**
 * 데이터 행인지 가려낸다.
 * 애매하면 지우지 않고 'uncertain'으로 분류해 사용자 확인 대상으로 넘긴다.
 *
 * requiredColumnIndexes: 그 시트에서 꼭 있어야 하는 항목(품목명·대상자 이름 등)이
 * 연결된 열. 이 칸 하나만 채워진 행은 "값이 하나뿐인 정상 데이터"로 본다.
 * (유통기한이 비어 있는 품목 행을 통째로 버리지 않기 위해)
 */
export function classifyRow(
  row: unknown[],
  columns: HeaderColumn[],
  labelColumnIndexes: number[],
  requiredColumnIndexes: number[] = [],
): RowClassification {
  const allIndexes = columns.map((c) => c.index);
  const filled = nonEmptyIndexes(row, allIndexes);

  if (filled.length === 0) return { kind: 'empty', message: '' };

  // 집계 행: 이름 칸에 "합계/소계/총계"가 적혀 있다.
  for (const index of labelColumnIndexes) {
    const text = normalizeSpace(row[index]);
    if (!text || text.length > 14) continue;
    const key = headerKeyLoose(text);
    if (!key) continue;
    if (AGGREGATE_EXACT.has(key) || AGGREGATE_SUFFIX.test(key)) {
      return { kind: 'aggregate', message: `집계 행("${text}")이라 저장하지 않습니다` };
    }
  }

  if (filled.length === 1) {
    const index = filled[0];
    const text = normalizeSpace(row[index]);
    if (NOTE_PREFIX.test(text) || text.length >= 15) {
      return { kind: 'note', message: '설명·각주 행이라 저장하지 않습니다' };
    }
    if (SECTION_PREFIX.test(text)) {
      return { kind: 'note', message: `구역 제목 행("${text}")이라 저장하지 않습니다` };
    }
    // 꼭 있어야 하는 항목이 채워져 있으면, 나머지가 비었어도 정상 데이터로 본다.
    if (requiredColumnIndexes.includes(index)) return { kind: 'data', message: '' };
    return {
      kind: 'uncertain',
      message: `한 칸("${text}")만 채워져 있어 데이터 행인지 판단하기 어렵습니다`,
    };
  }

  return { kind: 'data', message: '' };
}

/**
 * 집계 행 판정에 쓸 "이름 칸" 후보.
 * 숫자·날짜 항목에 연결된 열은 제외한다. (비고에 적힌 "합계"에 속지 않도록)
 */
export function pickLabelColumns(
  columns: HeaderColumn[],
  mapping: Map<number, string | null>,
  type: SheetType,
): number[] {
  const numberFields = NUMBER_FIELDS[type];
  const result: number[] = [];
  for (const col of columns) {
    const key = mapping.get(col.index) ?? null;
    if (key && numberFields.has(key as never)) continue;
    if (key && (key === 'inboundDate' || key === 'expirationDate' || key === 'consultDate' || key === 'birthDate')) {
      continue;
    }
    result.push(col.index);
  }
  // 이름 칸은 대개 앞쪽이다. 표가 넓을 때 뒤쪽 자유기재 칸까지 보지 않는다.
  return result.slice(0, 6);
}

/** 열 하나를 표준 필드에 맞춰본다. 확신이 낮으면 null. */
export function suggestForColumn(column: HeaderColumn, type: SheetType) {
  const match = matchColumn(column.candidates, type);
  return match && match.confidence >= SUGGEST_THRESHOLD ? match : null;
}
