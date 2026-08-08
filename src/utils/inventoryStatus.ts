import type { InventoryStatus as InventoryStatusLabel } from '../types';
import type { InventoryStatus as InventoryStatusRow } from '../store/analytics';

/**
 * 중앙 DB 재고 행 → main 화면이 쓰는 상태 라벨.
 *
 * 판정 근거는 전부 `v_inventory_status` 가 계산해 준 실제 값이다.
 * (유통기한 경과/임박은 view 에서, 재고 소진은 저장된 stock 값에서)
 * 화면마다 기준이 달라지지 않도록 이 함수 하나만 쓴다.
 */
export function inventoryStatusOf(row: InventoryStatusRow): InventoryStatusLabel {
  if (row.isExpired) return '확인 필요';
  if (row.isExpiringSoon) return '임박';
  if (row.stock <= 0) return '부족';
  return '정상';
}
