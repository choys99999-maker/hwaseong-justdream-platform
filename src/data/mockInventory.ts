import type { InventoryItem } from '../types';
import { REGION_NAMES } from './regionMeta';

export const mockInventoryItems: InventoryItem[] = [
  { id: 'inv-001', name: '쌀 10kg', regionId: 'seobu', regionName: REGION_NAMES.seobu, inboundQuantity: 120, outboundQuantity: 96, currentStock: 24, expiryDate: '2026-12-20', status: '정상' },
  { id: 'inv-002', name: '생리대 세트', regionId: 'seobu', regionName: REGION_NAMES.seobu, inboundQuantity: 80, outboundQuantity: 74, currentStock: 6, expiryDate: '2027-03-15', status: '부족' },
  { id: 'inv-003', name: '즉석밥 세트', regionId: 'seobu', regionName: REGION_NAMES.seobu, inboundQuantity: 200, outboundQuantity: 150, currentStock: 50, expiryDate: '2026-08-28', status: '임박' },
  { id: 'inv-004', name: '통조림 세트', regionId: 'seobu', regionName: REGION_NAMES.seobu, inboundQuantity: 90, outboundQuantity: 40, currentStock: 50, expiryDate: '2026-08-19', status: '임박' },
  { id: 'inv-005', name: '밑반찬 세트', regionId: 'seobu', regionName: REGION_NAMES.seobu, inboundQuantity: 60, outboundQuantity: 68, currentStock: -8, expiryDate: '2026-09-10', status: '확인 필요' },

  { id: 'inv-006', name: '라면 1박스', regionId: 'jungbu', regionName: REGION_NAMES.jungbu, inboundQuantity: 150, outboundQuantity: 90, currentStock: 60, expiryDate: '2027-01-10', status: '정상' },
  { id: 'inv-007', name: '기저귀 대형', regionId: 'jungbu', regionName: REGION_NAMES.jungbu, inboundQuantity: 70, outboundQuantity: 63, currentStock: 7, expiryDate: '2027-05-01', status: '부족' },
  { id: 'inv-008', name: '위생용품 세트', regionId: 'jungbu', regionName: REGION_NAMES.jungbu, inboundQuantity: 100, outboundQuantity: 55, currentStock: 45, expiryDate: '2026-08-24', status: '임박' },
  { id: 'inv-009', name: '분유 800g', regionId: 'jungbu', regionName: REGION_NAMES.jungbu, inboundQuantity: 40, outboundQuantity: 22, currentStock: 18, expiryDate: '2026-11-30', status: '정상' },
  { id: 'inv-010', name: '담요 1매', regionId: 'jungbu', regionName: REGION_NAMES.jungbu, inboundQuantity: 50, outboundQuantity: 12, currentStock: 38, expiryDate: '2028-01-01', status: '확인 필요' },

  { id: 'inv-011', name: '쌀 10kg', regionId: 'nambu', regionName: REGION_NAMES.nambu, inboundQuantity: 100, outboundQuantity: 82, currentStock: 18, expiryDate: '2026-12-05', status: '정상' },
  { id: 'inv-012', name: '부탄가스 8입', regionId: 'nambu', regionName: REGION_NAMES.nambu, inboundQuantity: 60, outboundQuantity: 55, currentStock: 5, expiryDate: '2029-01-01', status: '부족' },
  { id: 'inv-013', name: '생필품 꾸러미', regionId: 'nambu', regionName: REGION_NAMES.nambu, inboundQuantity: 80, outboundQuantity: 50, currentStock: 30, expiryDate: '2026-08-31', status: '임박' },
  { id: 'inv-014', name: '즉석밥 세트', regionId: 'nambu', regionName: REGION_NAMES.nambu, inboundQuantity: 130, outboundQuantity: 88, currentStock: 42, expiryDate: '2026-10-18', status: '정상' },

  { id: 'inv-015', name: '생리대 세트', regionId: 'dongbu', regionName: REGION_NAMES.dongbu, inboundQuantity: 90, outboundQuantity: 84, currentStock: 6, expiryDate: '2027-02-10', status: '부족' },
  { id: 'inv-016', name: '통조림 세트', regionId: 'dongbu', regionName: REGION_NAMES.dongbu, inboundQuantity: 110, outboundQuantity: 65, currentStock: 45, expiryDate: '2026-08-22', status: '임박' },
  { id: 'inv-017', name: '위생용품 세트', regionId: 'dongbu', regionName: REGION_NAMES.dongbu, inboundQuantity: 70, outboundQuantity: 30, currentStock: 40, expiryDate: '2026-11-05', status: '정상' },
  { id: 'inv-018', name: '쌀 10kg', regionId: 'dongbu', regionName: REGION_NAMES.dongbu, inboundQuantity: 100, outboundQuantity: 40, currentStock: 60, expiryDate: '2026-08-15', status: '확인 필요' },
  { id: 'inv-019', name: '담요 1매', regionId: 'dongbu', regionName: REGION_NAMES.dongbu, inboundQuantity: 40, outboundQuantity: 15, currentStock: 25, expiryDate: '2028-06-01', status: '정상' },

  { id: 'inv-020', name: '즉석밥 세트', regionId: 'dongtan', regionName: REGION_NAMES.dongtan, inboundQuantity: 180, outboundQuantity: 120, currentStock: 60, expiryDate: '2026-08-30', status: '임박' },
  { id: 'inv-021', name: '분유 800g', regionId: 'dongtan', regionName: REGION_NAMES.dongtan, inboundQuantity: 50, outboundQuantity: 45, currentStock: 5, expiryDate: '2026-12-12', status: '부족' },
  { id: 'inv-022', name: '라면 1박스', regionId: 'dongtan', regionName: REGION_NAMES.dongtan, inboundQuantity: 160, outboundQuantity: 100, currentStock: 60, expiryDate: '2027-02-20', status: '정상' },
  { id: 'inv-023', name: '생리대 세트', regionId: 'dongtan', regionName: REGION_NAMES.dongtan, inboundQuantity: 90, outboundQuantity: 70, currentStock: 20, expiryDate: '2026-08-25', status: '임박' },
  { id: 'inv-024', name: '생필품 꾸러미', regionId: 'dongtan', regionName: REGION_NAMES.dongtan, inboundQuantity: 70, outboundQuantity: 58, currentStock: 12, expiryDate: '2026-10-01', status: '정상' },
];
