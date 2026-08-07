import type { PlatformColumnDef, PlatformColumnKey } from '../types/upload';

export const PLATFORM_COLUMNS: PlatformColumnDef[] = [
  { key: 'region', label: '지역', required: false, aliases: [] },
  { key: 'organization', label: '기관명', required: false, aliases: [] },
  { key: 'itemName', label: '품목명', required: true, aliases: ['품목', '물품명', '상품명'] },
  { key: 'inboundQuantity', label: '입고수량', required: false, aliases: ['입고량'] },
  { key: 'outboundQuantity', label: '출고수량', required: false, aliases: ['출고량'] },
  { key: 'stock', label: '현재재고', required: false, aliases: ['재고', '재고량', '현재고', '잔량'] },
  { key: 'inboundDate', label: '입고일', required: false, aliases: [] },
  { key: 'expirationDate', label: '유통기한', required: false, aliases: ['소비기한', '유효기간', '기한'] },
];

export function autoMapColumns(
  excelColumns: string[],
): Record<string, PlatformColumnKey | null> {
  const mapping: Record<string, PlatformColumnKey | null> = {};
  const usedTargets = new Set<PlatformColumnKey>();

  for (const col of excelColumns) {
    const normalized = col.trim();
    let matched: PlatformColumnKey | null = null;

    for (const def of PLATFORM_COLUMNS) {
      if (usedTargets.has(def.key)) continue;
      if (normalized === def.label || def.aliases.includes(normalized)) {
        matched = def.key;
        break;
      }
    }

    if (matched) usedTargets.add(matched);
    mapping[col] = matched;
  }

  return mapping;
}
