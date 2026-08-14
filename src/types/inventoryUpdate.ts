/**
 * 관리자 재고 반영 모델.
 *
 * 자연어 빠른 입력과 Excel 일괄 반영이 **똑같이 이 모양으로 모인 뒤** 같은 저장 경로
 * (`store/inventoryUpdates.applyInventoryUpdate` → 기존 `saveSubmission` → `create_submission` RPC)
 * 를 탄다. 두 입구가 서로 다른 저장 규칙을 갖지 않게 하려고 모델을 하나로 둔다.
 *
 * 이 모델이 다루는 값은 **현재재고 스냅샷**뿐이다. 입고·출고(기간 누계)는 일부러 담지 않는다.
 *   - 중앙 DB(`v_inventory_status`)는 입고·출고를 제출본 전체에 걸쳐 sum 한다. 같은 재고표를
 *     이 화면으로 여러 번 반영하면 입출고가 이중 집계된다.
 *   - 현재재고·유통기한은 "가장 최근 제출본의 값"만 쓰는 스냅샷이라 몇 번을 반영해도 안전하다.
 * 입출고 이력까지 남겨야 하면 기존 [자료 관리 > 자료 올리기] 화면을 그대로 쓴다.
 */

/** 재고 반영 한 줄. (읍면동 × 품목) 하나에 해당한다. */
export interface InventoryUpdateLine {
  itemName: string;
  /** 반영할 현재재고. null 이면 값을 읽지 못한 것 — 담당자가 채우기 전에는 반영하지 않는다. */
  stock: number | null;
  /**
   * 유통기한. 비워 두면 지금 중앙 DB 에 있는 값을 그대로 이어 쓴다.
   * (스냅샷 필드라 비운 채 저장하면 화면에서 유통기한이 사라진다)
   */
  expirationDate: string | null;
  /** 이 값을 어디서 읽었는지. 확인 화면에 그대로 보여준다. (자연어 문장 조각 / 엑셀 N행) */
  sourceText: string;
  /** 담당자가 확인해야 할 사유. 있으면 확인 화면이 그대로 노출한다. */
  issue?: string;
}

/** 반영 직전, 지금 값과 바뀔 값을 나란히 놓은 한 줄. 확인 화면과 미리보기가 함께 쓴다. */
export interface InventoryUpdateDiff extends InventoryUpdateLine {
  /** 중앙 DB 의 현재 재고. 처음 보는 품목이면 null. */
  currentStock: number | null;
  /** 중앙 DB 에 이 품목이 이미 있는지 */
  isNewItem: boolean;
  /** 값이 실제로 달라지는 줄인지. 같으면 반영해도 화면이 안 바뀐다는 뜻이라 함께 알린다. */
  isUnchanged: boolean;
}

export type InventoryUpdateOrigin = 'quick' | 'excel';

/** 저장 직전의 반영 묶음. */
export interface InventoryUpdateDraft {
  origin: InventoryUpdateOrigin;
  organizationId: string;
  organizationName: string;
  regionName: string;
  lines: InventoryUpdateLine[];
}

export interface InventoryUpdateResult {
  submissionId: string;
  /** 실제로 저장된 품목 수 */
  appliedCount: number;
  /** 자료·데이터 관리 목록에 남는 이름 */
  fileName: string;
}
