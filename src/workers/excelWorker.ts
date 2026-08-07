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
import { detectSheetType } from '../utils/columnMapping';

interface SheetData {
  rows: unknown[][];
  headers: Array<{ name: string; idx: number }>;
  sheetType: SheetType;
  dataStartRow: number;
}

const storedSheets = new Map<string, SheetData>();

interface SheetConfig {
  sectionLabelRows: number;
  headerRowCount: number;
}

const SHEET_CONFIGS: Record<SheetType, SheetConfig> = {
  performance: { sectionLabelRows: 0, headerRowCount: 3 },
  referral:    { sectionLabelRows: 1, headerRowCount: 1 },
  generic:     { sectionLabelRows: 0, headerRowCount: 1 },
};

const NUMBER_FIELDS = new Set<PlatformColumnKey>([
  'userCount', 'basicConsultation', 'referralTotal', 'linkageCompleted',
  'basicLivelihood', 'nearPoverty', 'emergencyWelfare', 'otherLinkage',
  'underReview', 'noLinkageNeeded',
  'serialNo',
  'inboundQuantity', 'outboundQuantity', 'stock',
]);

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

function parseSheetData(ws: XLSX.WorkSheet, sheetType: SheetType): SheetData {
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  const config = SHEET_CONFIGS[sheetType];

  let firstNonEmptyIdx = 0;
  for (let i = 0; i < allRows.length; i++) {
    if ((allRows[i] as unknown[]).some((c) => String(c).trim() !== '')) {
      firstNonEmptyIdx = i;
      break;
    }
  }

  const headerStartIdx = firstNonEmptyIdx + config.sectionLabelRows;
  const headerEndIdx = headerStartIdx + config.headerRowCount;
  const headerRows = allRows.slice(headerStartIdx, headerEndIdx) as unknown[][];

  const colCount = headerRows.length > 0
    ? Math.max(...headerRows.map((r) => (r as unknown[]).length))
    : 0;

  const headers: Array<{ name: string; idx: number }> = [];
  for (let col = 0; col < colCount; col++) {
    const cells = headerRows.map((r) => String((r as unknown[])[col] ?? ''));
    const name = buildFlatColName(cells);
    if (name) headers.push({ name, idx: col });
  }

  const dataRows = allRows.slice(headerEndIdx);

  return {
    rows: dataRows,
    headers,
    sheetType,
    dataStartRow: headerEndIdx + 1,
  };
}

function handleParse(buffer: ArrayBuffer) {
  const wb = XLSX.read(buffer, { type: 'array' });
  storedSheets.clear();

  const sheets: SheetParseResult[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const sheetType = detectSheetType(sheetName);
    const data = parseSheetData(ws, sheetType);

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
    });
  }

  self.postMessage({ type: 'parse-done', sheets });
}

function parseDate(val: unknown): string | null {
  if (val === '' || val === null || val === undefined) return null;

  if (typeof val === 'number' && val > 10000 && val < 100000) {
    const utcMs = (val - 25569) * 86400000;
    const d = new Date(utcMs);
    if (!isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }
  }

  const s = String(val).trim();
  if (!s) return null;

  const isoMatch = s.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }

  const korMatch = s.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (korMatch) {
    const [, y, m, d] = korMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];

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

function handleConvert(sheetMappings: Record<string, Record<string, string | null>>) {
  const results: SheetConvertResult[] = [];

  for (const [sheetName, mapping] of Object.entries(sheetMappings)) {
    const data = storedSheets.get(sheetName);
    if (!data) continue;

    const { rows, headers, dataStartRow } = data;
    const records: MappedRecord[] = [];
    const errors: ValidationError[] = [];

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

      const record: MappedRecord = {};

      for (const [key, idx] of colMap) {
        const rawVal = arr[idx];
        const strVal = String(rawVal ?? '').trim();

        if (key === 'birthDate') {
          if (strVal) {
            const dateStr = parseBirthDate(rawVal);
            if (!dateStr) {
              errors.push({ rowIndex, field: key, message: `생년월일을 인식할 수 없습니다: "${strVal}"` });
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
                message: `${FIELD_LABELS[key] ?? key} 값이 숫자가 아닙니다: "${strVal}"`,
              });
            } else if (key === 'stock' && num < 0) {
              errors.push({ rowIndex, field: key, message: `재고가 음수입니다: ${num}` });
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

    results.push({ sheetName, records, errors });
  }

  self.postMessage({ type: 'convert-done', sheets: results });
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as {
    type: string;
    buffer?: ArrayBuffer;
    sheetMappings?: Record<string, Record<string, string | null>>;
  };
  try {
    if (msg.type === 'parse' && msg.buffer) handleParse(msg.buffer);
    else if (msg.type === 'convert') handleConvert(msg.sheetMappings ?? {});
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.',
    });
  }
};
