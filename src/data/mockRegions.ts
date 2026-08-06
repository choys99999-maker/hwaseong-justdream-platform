import type { MonthlyTrendPoint, OperationStatus, Region, RegionId } from '../types';
import { REGION_NAMES, REGION_ORDER } from './regionMeta';
import { mockSupportRecords } from './mockSupportRecords';
import { mockInventoryItems } from './mockInventory';

interface RegionBase {
  id: RegionId;
  status: OperationStatus;
  orgCount: number;
  userCount: number;
  lastUpdated: string;
  monthlyTrend: MonthlyTrendPoint[];
}

const regionBases: RegionBase[] = [
  {
    id: 'seobu',
    status: '정상',
    orgCount: 9,
    userCount: 1580,
    lastUpdated: '2026-08-05T18:20:00',
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
    id: 'jungbu',
    status: '주의',
    orgCount: 7,
    userCount: 1320,
    lastUpdated: '2026-08-06T09:10:00',
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
    id: 'nambu',
    status: '정상',
    orgCount: 6,
    userCount: 980,
    lastUpdated: '2026-08-04T15:40:00',
    monthlyTrend: [
      { month: '3월', count: 30 },
      { month: '4월', count: 33 },
      { month: '5월', count: 35 },
      { month: '6월', count: 31 },
      { month: '7월', count: 38 },
      { month: '8월', count: 16 },
    ],
  },
  {
    id: 'dongbu',
    status: '확인 필요',
    orgCount: 8,
    userCount: 1150,
    lastUpdated: '2026-08-03T11:05:00',
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
    status: '주의',
    orgCount: 11,
    userCount: 2040,
    lastUpdated: '2026-08-06T08:30:00',
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

export const mockRegions: Region[] = REGION_ORDER.map((id) => {
  const base = regionBases.find((region) => region.id === id)!;
  return {
    id: base.id,
    name: REGION_NAMES[base.id],
    status: base.status,
    orgCount: base.orgCount,
    userCount: base.userCount,
    lastUpdated: base.lastUpdated,
    monthlyTrend: base.monthlyTrend,
    ...computeAggregates(base.id),
  };
});

export function getRegionById(id: string | undefined): Region | undefined {
  return mockRegions.find((region) => region.id === id);
}
