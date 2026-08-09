import type { InventoryItem } from '../types';
import { REGION_NAMES } from './regionMeta';

export const mockInventoryItems: InventoryItem[] = [
  { id: 'inv-001', name: '쌀 10kg',        category: '식품',     regionId: 'manse',     regionName: REGION_NAMES.manse,     baseStock: 10, inboundQuantity: 120, outboundQuantity: 96,  discardQuantity: 10, currentStock: 24,  expiryDate: '2026-12-20', status: '정상' },
  { id: 'inv-002', name: '생리대 세트',     category: '위생용품', regionId: 'manse',     regionName: REGION_NAMES.manse,     baseStock: 2,  inboundQuantity: 80,  outboundQuantity: 74,  discardQuantity: 2,  currentStock: 6,   expiryDate: '2027-03-15', status: '부족' },
  { id: 'inv-003', name: '즉석밥 세트',     category: '식품',     regionId: 'manse',     regionName: REGION_NAMES.manse,     baseStock: 5,  inboundQuantity: 200, outboundQuantity: 150, discardQuantity: 5,  currentStock: 50,  expiryDate: '2026-08-28', status: '임박' },
  { id: 'inv-004', name: '통조림 세트',     category: '식품',     regionId: 'manse',     regionName: REGION_NAMES.manse,     baseStock: 8,  inboundQuantity: 90,  outboundQuantity: 40,  discardQuantity: 8,  currentStock: 50,  expiryDate: '2026-08-19', status: '임박' },
  { id: 'inv-005', name: '밑반찬 세트',     category: '식품',     regionId: 'manse',     regionName: REGION_NAMES.manse,     baseStock: 0,  inboundQuantity: 60,  outboundQuantity: 68,  discardQuantity: 0,  currentStock: -8,  expiryDate: '2026-09-10', status: '확인 필요' },

  { id: 'inv-006', name: '라면 1박스',      category: '식품',     regionId: 'hyohaeng',  regionName: REGION_NAMES.hyohaeng,  baseStock: 0,  inboundQuantity: 150, outboundQuantity: 90,  discardQuantity: 0,  currentStock: 60,  expiryDate: '2027-01-10', status: '정상' },
  { id: 'inv-007', name: '기저귀 대형',     category: '영유아용품', regionId: 'hyohaeng', regionName: REGION_NAMES.hyohaeng,  baseStock: 2,  inboundQuantity: 70,  outboundQuantity: 63,  discardQuantity: 2,  currentStock: 7,   expiryDate: '2027-05-01', status: '부족' },
  { id: 'inv-008', name: '위생용품 세트',   category: '위생용품', regionId: 'hyohaeng',  regionName: REGION_NAMES.hyohaeng,  baseStock: 0,  inboundQuantity: 100, outboundQuantity: 55,  discardQuantity: 0,  currentStock: 45,  expiryDate: '2026-08-24', status: '임박' },
  { id: 'inv-009', name: '분유 800g',       category: '영유아용품', regionId: 'hyohaeng', regionName: REGION_NAMES.hyohaeng,  baseStock: 2,  inboundQuantity: 40,  outboundQuantity: 22,  discardQuantity: 2,  currentStock: 18,  expiryDate: '2026-11-30', status: '정상' },
  { id: 'inv-010', name: '담요 1매',        category: '생필품',   regionId: 'hyohaeng',  regionName: REGION_NAMES.hyohaeng,  baseStock: 0,  inboundQuantity: 50,  outboundQuantity: 12,  discardQuantity: 0,  currentStock: 38,  expiryDate: '2028-01-01', status: '확인 필요' },

  { id: 'inv-011', name: '쌀 10kg',        category: '식품',     regionId: 'manse',     regionName: REGION_NAMES.manse,     baseStock: 5,  inboundQuantity: 100, outboundQuantity: 82,  discardQuantity: 5,  currentStock: 18,  expiryDate: '2026-12-05', status: '정상' },
  { id: 'inv-012', name: '부탄가스 8입',    category: '생필품',   regionId: 'hyohaeng',  regionName: REGION_NAMES.hyohaeng,  baseStock: 0,  inboundQuantity: 60,  outboundQuantity: 55,  discardQuantity: 0,  currentStock: 5,   expiryDate: '2029-01-01', status: '부족' },
  { id: 'inv-013', name: '생필품 꾸러미',   category: '생필품',   regionId: 'byeongjeom', regionName: REGION_NAMES.byeongjeom, baseStock: 3, inboundQuantity: 80,  outboundQuantity: 50,  discardQuantity: 3,  currentStock: 30,  expiryDate: '2026-08-31', status: '임박' },
  { id: 'inv-014', name: '즉석밥 세트',     category: '식품',     regionId: 'dongtan',   regionName: REGION_NAMES.dongtan,   baseStock: 5,  inboundQuantity: 130, outboundQuantity: 88,  discardQuantity: 5,  currentStock: 42,  expiryDate: '2026-10-18', status: '정상' },

  { id: 'inv-015', name: '생리대 세트',     category: '위생용품', regionId: 'byeongjeom', regionName: REGION_NAMES.byeongjeom, baseStock: 3, inboundQuantity: 90,  outboundQuantity: 84,  discardQuantity: 3,  currentStock: 6,   expiryDate: '2027-02-10', status: '부족' },
  { id: 'inv-016', name: '통조림 세트',     category: '식품',     regionId: 'byeongjeom', regionName: REGION_NAMES.byeongjeom, baseStock: 8, inboundQuantity: 110, outboundQuantity: 65,  discardQuantity: 8,  currentStock: 45,  expiryDate: '2026-08-22', status: '임박' },
  { id: 'inv-017', name: '위생용품 세트',   category: '위생용품', regionId: 'byeongjeom', regionName: REGION_NAMES.byeongjeom, baseStock: 0, inboundQuantity: 70,  outboundQuantity: 30,  discardQuantity: 0,  currentStock: 40,  expiryDate: '2026-11-05', status: '정상' },
  { id: 'inv-018', name: '쌀 10kg',        category: '식품',     regionId: 'byeongjeom', regionName: REGION_NAMES.byeongjeom, baseStock: 0, inboundQuantity: 100, outboundQuantity: 40,  discardQuantity: 0,  currentStock: 60,  expiryDate: '2026-08-15', status: '확인 필요' },
  { id: 'inv-019', name: '담요 1매',        category: '생필품',   regionId: 'byeongjeom', regionName: REGION_NAMES.byeongjeom, baseStock: 0, inboundQuantity: 40,  outboundQuantity: 15,  discardQuantity: 0,  currentStock: 25,  expiryDate: '2028-06-01', status: '정상' },

  { id: 'inv-020', name: '즉석밥 세트',     category: '식품',     regionId: 'dongtan',   regionName: REGION_NAMES.dongtan,   baseStock: 8,  inboundQuantity: 180, outboundQuantity: 120, discardQuantity: 8,  currentStock: 60,  expiryDate: '2026-08-30', status: '임박' },
  { id: 'inv-021', name: '분유 800g',       category: '영유아용품', regionId: 'dongtan',  regionName: REGION_NAMES.dongtan,   baseStock: 2,  inboundQuantity: 50,  outboundQuantity: 45,  discardQuantity: 2,  currentStock: 5,   expiryDate: '2026-12-12', status: '부족' },
  { id: 'inv-022', name: '라면 1박스',      category: '식품',     regionId: 'dongtan',   regionName: REGION_NAMES.dongtan,   baseStock: 0,  inboundQuantity: 160, outboundQuantity: 100, discardQuantity: 0,  currentStock: 60,  expiryDate: '2027-02-20', status: '정상' },
  { id: 'inv-023', name: '생리대 세트',     category: '위생용품', regionId: 'dongtan',   regionName: REGION_NAMES.dongtan,   baseStock: 3,  inboundQuantity: 90,  outboundQuantity: 70,  discardQuantity: 3,  currentStock: 20,  expiryDate: '2026-08-25', status: '임박' },
  { id: 'inv-024', name: '생필품 꾸러미',   category: '생필품',   regionId: 'dongtan',   regionName: REGION_NAMES.dongtan,   baseStock: 2,  inboundQuantity: 70,  outboundQuantity: 58,  discardQuantity: 2,  currentStock: 12,  expiryDate: '2026-10-01', status: '정상' },
];
