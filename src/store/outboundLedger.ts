import { siteAreaOf } from '../data/mockSites';
import { makeId } from '../utils/supportRecords';

/**
 * 현장 출고 원장.
 *
 * 이용·상담 관리에서 물품지원이 확정되면 품목 1줄당 출고 레코드 1건을 만들고,
 * 그 id 를 `SupportItem.outboundRecordId` 에 되돌려 준다. 물품 현황 화면은
 * 이 원장을 구독해 해당 (읍면동 × 품목) 의 표시 재고에서 출고 수량을 뺀다.
 *
 * 저장 위치에 대해
 * - 이용·상담 도메인(Client/Visit)은 아직 화면 상태 + 시연 시드로만 존재한다.
 *   방문 id 가 새로고침마다 사라지는데 출고만 중앙 DB 에 쓰면 서로 가리키는 곳이
 *   어긋난 기록이 쌓이므로, 원장도 같은 수명(세션)으로 둔다.
 * - 이용·상담이 중앙 저장소로 넘어갈 때 `createOutboundRecords` 를 RPC 호출로
 *   바꾸면 된다. 호출부 인터페이스는 그 전환을 전제로 설계했다.
 *
 * 품목 식별자에 대해
 * - 중앙 재고(v_inventory_status)에는 품목 고유 id 가 없고 (조직 × 품목명) 이 키다.
 *   따라서 품목 id 의 기준(canonical)은 `supportItemCatalog.ts` 의 itemId 하나뿐이며,
 *   재고와의 연결은 읍면동(organizationName) + itemName 으로 잇는다.
 *   itemId 와 itemName 은 계속 분리해서 들고 다닌다.
 */
export interface OutboundRecord {
  id: string;
  visitId: string;
  clientId: string;
  siteId: string;
  siteName: string;
  /** 사업장이 속한 읍면동. 중앙 재고의 organizationName 과 같은 이름 체계. 매핑 불가면 null. */
  organizationName: string | null;
  itemId: string;
  itemName: string;
  quantity: number;
  unit?: string;
  outboundDate: string;
}

export interface OutboundInput {
  visitId: string;
  clientId: string;
  siteId: string;
  siteName: string;
  outboundDate: string;
  items: { itemId: string; itemName: string; quantity: number; unit?: string }[];
}

let records: OutboundRecord[] = [];
const listeners = new Set<() => void>();

export function subscribeOutbound(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** useSyncExternalStore 스냅샷. 변경 시에만 배열 참조가 바뀐다. */
export function getOutboundSnapshot(): OutboundRecord[] {
  return records;
}

/** 방문 1건의 지원 물품을 출고 레코드로 만든다. 품목 1줄 = 레코드 1건. */
export function createOutboundRecords(input: OutboundInput): OutboundRecord[] {
  const organizationName = siteAreaOf(input.siteId);
  const created = input.items.map((item) => ({
    id: makeId('ob'),
    visitId: input.visitId,
    clientId: input.clientId,
    siteId: input.siteId,
    siteName: input.siteName,
    organizationName,
    itemId: item.itemId,
    itemName: item.itemName,
    quantity: item.quantity,
    unit: item.unit,
    outboundDate: input.outboundDate,
  }));

  records = [...records, ...created];
  listeners.forEach((listener) => listener());
  return created;
}

/** (읍면동 × 품목명) → 현장 출고 수량 합. 재고 화면이 표시 재고에서 뺄 값이다. */
export function outboundByOrgItem(list: OutboundRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const record of list) {
    if (!record.organizationName) continue;
    const key = `${record.organizationName}::${record.itemName}`;
    map.set(key, (map.get(key) ?? 0) + record.quantity);
  }
  return map;
}
