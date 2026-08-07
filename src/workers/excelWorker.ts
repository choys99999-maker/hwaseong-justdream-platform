/// <reference lib="webworker" />
import * as XLSX from 'xlsx';
import type { PlatformColumnKey, MappedRecord, ValidationError } from '../types/upload';

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
    columns,
    previewRows,
    totalRows: storedRows.length - 1,
  });
}

function parseDate(val: unknown): string | null {
  if (val === '' || val === null || val === undefined) return null;

  // Excel serial number (days since Dec 30 1899)
  if (typeof val === 'number' && val > 0) {
    const utcMs = (val - 25569) * 86400000;
    const d = new Date(utcMs);
    if (!isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }
  }

  const s = String(val).trim();
  if (!s) return null;

  // YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD
  const isoMatch = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // YYYYMMDD
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }

  // 한국식: 2026년 8월 30일
  const korMatch = s.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (korMatch) {
    const [, y, m, d] = korMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // 마지막 수단: Date.parse
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

const NUMBER_FIELDS = new Set<PlatformColumnKey>(['inboundQuantity', 'outboundQuantity', 'stock']);
const DATE_FIELDS = new Set<PlatformColumnKey>(['inboundDate', 'expirationDate']);
const FIELD_LABELS: Record<PlatformColumnKey, string> = {
  region: '지역',
  organization: '기관명',
  itemName: '품목명',
  inboundQuantity: '입고수량',
  outboundQuantity: '출고수량',
  stock: '현재재고',
  inboundDate: '입고일',
  expirationDate: '유통기한',
};

function handleConvert(mapping: Record<string, string | null>) {
  const dataRows = storedRows.slice(1);
  const records: MappedRecord[] = [];
  const errors: ValidationError[] = [];

  // 플랫폼 키 → 헤더 인덱스
  const colMap = new Map<PlatformColumnKey, number>();
  for (const header of storedHeaders) {
    const target = mapping[header.name];
    if (target) colMap.set(target as PlatformColumnKey, header.idx);
  }

  for (let i = 0; i < dataRows.length; i++) {
    const arr = dataRows[i] as unknown[];
    const rowIndex = i + 2; // 2행부터 시작 (1행은 헤더)
    const record: MappedRecord = {};

    for (const [key, idx] of colMap) {
      const rawVal = arr[idx];
      const strVal = String(rawVal ?? '').trim();

      if (key === 'itemName') {
        if (!strVal) {
          errors.push({ rowIndex, field: 'itemName', message: '품목명이 비어있습니다.' });
        } else {
          record.itemName = strVal;
        }
      } else if (key === 'region' || key === 'organization') {
        if (strVal) (record as Record<string, unknown>)[key] = strVal;
      } else if (NUMBER_FIELDS.has(key)) {
        if (strVal) {
          const num = Number(strVal.replace(/,/g, ''));
          if (isNaN(num)) {
            errors.push({
              rowIndex,
              field: key,
              message: `${FIELD_LABELS[key]} 값이 숫자가 아닙니다: "${strVal}"`,
            });
          } else if (key === 'stock' && num < 0) {
            errors.push({ rowIndex, field: 'stock', message: `재고가 음수입니다: ${num}` });
          } else {
            (record as Record<string, unknown>)[key] = num;
          }
        }
      } else if (DATE_FIELDS.has(key)) {
        if (strVal) {
          const dateStr = parseDate(rawVal);
          if (!dateStr) {
            errors.push({
              rowIndex,
              field: key,
              message: `${FIELD_LABELS[key]} 날짜를 인식할 수 없습니다: "${strVal}"`,
            });
          } else {
            (record as Record<string, unknown>)[key] = dateStr;
          }
        }
      }
    }

    records.push(record);
  }

  self.postMessage({ type: 'convert-done', records, errors });
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as {
    type: string;
    buffer?: ArrayBuffer;
    mapping?: Record<string, string | null>;
  };
  try {
    if (msg.type === 'parse' && msg.buffer) handleParse(msg.buffer);
    else if (msg.type === 'convert') handleConvert(msg.mapping ?? {});
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.',
    });
  }
};
