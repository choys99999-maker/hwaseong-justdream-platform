import type { DistrictId } from '../types';
import type { InventoryStatus, RegionUsage } from '../store/analytics';
import { districtOfArea } from '../data/districtByArea';
import { REGION_ORDER } from '../data/regionMeta';

/**
 * 중앙 DB의 읍면동 단위 집계를 main 화면의 4개 구 단위로 굴려 올린다.
 *
 * 값을 새로 만들지 않는다. `v_region_usage` / `v_inventory_status` 가 이미
 * "유효한 제출본 + 누계 시트 제외" 를 적용해 내려준 값을 더하기만 한다.
 */
export interface DistrictCentralSummary {
  /** 자료를 제출한 읍면동 수 (전체 읍면동 수가 아니다) */
  organizationCount: number;
  userCount: number;
  basicConsultation: number;
  referralTotal: number;
  linkageCompleted: number;
  referralCount: number;
  itemCount: number;
  totalStock: number;
  expiringSoonCount: number;
  expiredCount: number;
  lastUploadedAt: string | null;
}

function emptySummary(): DistrictCentralSummary {
  return {
    organizationCount: 0,
    userCount: 0,
    basicConsultation: 0,
    referralTotal: 0,
    linkageCompleted: 0,
    referralCount: 0,
    itemCount: 0,
    totalStock: 0,
    expiringSoonCount: 0,
    expiredCount: 0,
    lastUploadedAt: null,
  };
}

export function rollupByDistrict(
  usage: RegionUsage[],
  inventory: InventoryStatus[],
): Record<DistrictId, DistrictCentralSummary> {
  const result = Object.fromEntries(
    REGION_ORDER.map((id) => [id, emptySummary()]),
  ) as Record<DistrictId, DistrictCentralSummary>;

  for (const row of usage) {
    const id = districtOfArea(row.organizationName);
    if (!id) continue;
    const acc = result[id];
    acc.organizationCount += 1;
    acc.userCount += row.userCount;
    acc.basicConsultation += row.basicConsultation;
    acc.referralTotal += row.referralTotal;
    acc.linkageCompleted += row.linkageCompleted;
    acc.referralCount += row.referralCount;
    acc.itemCount += row.itemCount;
    acc.totalStock += row.totalStock;
    if (row.lastUploadedAt && (!acc.lastUploadedAt || row.lastUploadedAt > acc.lastUploadedAt)) {
      acc.lastUploadedAt = row.lastUploadedAt;
    }
  }

  // 유통기한 임박·경과는 품목 단위라 재고 행에서 따로 센다.
  for (const item of inventory) {
    const id = districtOfArea(item.organizationName);
    if (!id) continue;
    if (item.isExpiringSoon) result[id].expiringSoonCount += 1;
    if (item.isExpired) result[id].expiredCount += 1;
  }

  return result;
}
