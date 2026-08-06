import type { MonthlyTrendPoint, Region, RegionId } from '../types';
import { REGION_NAMES, REGION_ORDER } from './regionMeta';
import { mockSupportRecords } from './mockSupportRecords';
import { mockInventoryItems } from './mockInventory';
import { mockSites } from './mockSites';

interface RegionBase {
  id: RegionId;
  userCount: number;
  monthlyTrend: MonthlyTrendPoint[];
}

/**
 * 구별 이용자 수와 월별 추이는 합성 데이터다.
 * 거점 수·최근 업데이트 시각은 거점 데이터(`mockSites`)에서 계산하고,
 * 운영 상태는 `operationSummary` 의 재고 위험도를 쓴다.
 * 지도와 지역 카드가 다른 값을 보여주지 않도록 계산 위치를 한 곳으로 모았다.
 */
const regionBases: RegionBase[] = [
  {
    id: 'manse',
    userCount: 1580,
    monthlyTrend: [
      { month: '3월', count: 52 },
      { month: '4월', count: 58 },
      { month: '5월', count: 61 },
      { month: '6월', count: 55 },
      { month: '7월', count: 64 },
      { month: '8월', count: 34 },
    ],
  },
  {
    id: 'hyohaeng',
    userCount: 1320,
    monthlyTrend: [
      { month: '3월', count: 40 },
      { month: '4월', count: 46 },
      { month: '5월', count: 44 },
      { month: '6월', count: 49 },
      { month: '7월', count: 45 },
      { month: '8월', count: 22 },
    ],
  },
  {
    id: 'byeongjeom',
    userCount: 1150,
    monthlyTrend: [
      { month: '3월', count: 37 },
      { month: '4월', count: 41 },
      { month: '5월', count: 39 },
      { month: '6월', count: 43 },
      { month: '7월', count: 40 },
      { month: '8월', count: 18 },
    ],
  },
  {
    id: 'dongtan',
    userCount: 2040,
    monthlyTrend: [
      { month: '3월', count: 60 },
      { month: '4월', count: 66 },
      { month: '5월', count: 70 },
      { month: '6월', count: 68 },
      { month: '7월', count: 74 },
      { month: '8월', count: 39 },
    ],
  },
];

function computeAggregates(regionId: RegionId) {
  const monthlySupportCount = mockSupportRecords.filter((record) => record.regionId === regionId).length;
  const regionInventory = mockInventoryItems.filter((item) => item.regionId === regionId);
  const inventoryCount = regionInventory.length;
  const expiringSoonCount = regionInventory.filter((item) => item.status === '임박').length;
  return { monthlySupportCount, inventoryCount, expiringSoonCount };
}

function computeSiteAggregates(regionId: RegionId) {
  const sites = mockSites.filter((site) => site.district === regionId);
  const lastUpdated = sites.reduce(
    (latest, site) => (site.lastUpdatedAt > latest ? site.lastUpdatedAt : latest),
    sites[0]?.lastUpdatedAt ?? '',
  );
  return { orgCount: sites.length, lastUpdated };
}

export const mockRegions: Region[] = REGION_ORDER.map((id) => {
  const base = regionBases.find((region) => region.id === id)!;
  return {
    id: base.id,
    name: REGION_NAMES[base.id],
    userCount: base.userCount,
    monthlyTrend: base.monthlyTrend,
    ...computeSiteAggregates(base.id),
    ...computeAggregates(base.id),
  };
});

export function getRegionById(id: string | undefined): Region | undefined {
  return mockRegions.find((region) => region.id === id);
}
