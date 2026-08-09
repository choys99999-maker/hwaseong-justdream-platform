/**
 * 재배분 검토 상태 저장소.
 *
 * `operationSummary.ts` 가 계산한 재배분 추천(제안)에 대해 담당자의 검토 진행 상태를
 * 세션 동안 들고 있는다. 상태 흐름: 제안 → 검토중 → 승인 → 완료.
 *
 * 추천 자체(수량·경로)는 합성 데이터에서 결정론적으로 계산되므로 여기 저장하지 않고,
 * 상태만 추천 id 에 매달아 둔다. 실제 저장 백엔드가 붙으면 setPlanStatus 를
 * RPC 호출로 바꾸면 되도록 호출부 인터페이스를 좁게 유지한다. (outboundLedger 와 같은 수명)
 */
export type PlanStatus = '제안' | '검토중' | '승인' | '완료';

export const PLAN_STATUS_ORDER: PlanStatus[] = ['제안', '검토중', '승인', '완료'];

let snapshot: Record<string, PlanStatus> = {};
const listeners = new Set<() => void>();

export function subscribePlan(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** useSyncExternalStore 스냅샷. 변경 시에만 객체 참조가 바뀐다. */
export function getPlanSnapshot(): Record<string, PlanStatus> {
  return snapshot;
}

export function planStatusOf(statuses: Record<string, PlanStatus>, id: string): PlanStatus {
  return statuses[id] ?? '제안';
}

export function setPlanStatus(id: string, status: PlanStatus): void {
  if (snapshot[id] === status) return;
  snapshot = { ...snapshot, [id]: status };
  listeners.forEach((listener) => listener());
}

/** 아직 완료 처리되지 않아 담당자 검토가 남아 있는 추천 건수. */
export function countPendingReview(statuses: Record<string, PlanStatus>, ids: string[]): number {
  return ids.filter((id) => planStatusOf(statuses, id) !== '완료').length;
}
