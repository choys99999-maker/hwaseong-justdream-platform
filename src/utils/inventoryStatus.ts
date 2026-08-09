import type { InventoryStatus as InventoryStatusLabel } from '../types';
import type { InventoryStatus as InventoryStatusRow } from '../store/analytics';

/**
 * 재고 상태 라벨.
 *
 * 판정은 **중앙 DB(`v_inventory_status`)에서 이미 끝나 있다.** 여기서 다시 계산하지 않는다.
 * (재고 계산·이상 판정 SSOT: `supabase/migrations/20260808020000_phase3_inventory_ssot.sql`)
 *
 * 규칙 우선순위: 확인 필요 > 임박 > 부족 > 정상
 *   - 확인 필요 : 데이터 이상(출고>입고 / 재고 음수 / 현재재고 불일치 / 근거 없음) 또는 기한 경과
 *   - 임박      : 유통기한 30일 이내
 *   - 부족      : 재고 <= 0
 *   - 정상      : 그 외
 *
 * 이 함수를 남겨 둔 이유는 호출부(대시보드·물품재고·지역상세)가 한 곳만 보게 하기 위해서다.
 */
export function inventoryStatusOf(row: InventoryStatusRow): InventoryStatusLabel {
  if (row.status) return row.status;

  // Phase 3 마이그레이션 전 DB에 붙었을 때만 타는 경로. 값을 지어내지 않고 보수적으로 판정한다.
  if (row.isExpired) return '확인 필요';
  if (row.isExpiringSoon) return '임박';
  if (row.stock === null) return '확인 필요';
  if (row.stock <= 0) return '부족';
  return '정상';
}
