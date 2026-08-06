import { mockInventoryItems } from './mockInventory';

/**
 * 월별 입고·출고 추이(합성 데이터).
 *
 * 물품·유통기한 화면의 총 입고량·총 배부량과 어긋나지 않도록,
 * `mockInventoryItems` 합계를 고정 가중치로 6개월에 배분한다.
 * 8월은 진행 중인 달이라 가중치를 낮게 뒀다.
 */
const MONTH_WEIGHTS: { month: string; weight: number }[] = [
  { month: '3월', weight: 0.18 },
  { month: '4월', weight: 0.19 },
  { month: '5월', weight: 0.17 },
  { month: '6월', weight: 0.18 },
  { month: '7월', weight: 0.19 },
  { month: '8월', weight: 0.09 },
];

export const totalInboundQuantity = mockInventoryItems.reduce((sum, item) => sum + item.inboundQuantity, 0);
export const totalOutboundQuantity = mockInventoryItems.reduce((sum, item) => sum + item.outboundQuantity, 0);

export interface InventoryFlowPoint {
  month: string;
  inbound: number;
  outbound: number;
}

export const monthlyInventoryFlow: InventoryFlowPoint[] = MONTH_WEIGHTS.map(({ month, weight }) => ({
  month,
  inbound: Math.round(totalInboundQuantity * weight),
  outbound: Math.round(totalOutboundQuantity * weight),
}));
