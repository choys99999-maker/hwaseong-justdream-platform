import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { mockRegions } from '../data/mockRegions';
import { mockSupportRecords } from '../data/mockSupportRecords';
import { mockInventoryItems } from '../data/mockInventory';
import { mockDataIssues } from '../data/mockDataIssues';
import type { DataIssueAlert, InventoryItem, Region, RegionId, SupportRecord } from '../types';

export interface DataScope {
  isSystemAdmin: boolean;
  effectiveRegionId: RegionId | null; // null = 전체 (SYSTEM_ADMIN 전체 보기)
  regions: Region[];
  supportRecords: SupportRecord[];
  inventoryItems: InventoryItem[];
  dataIssues: DataIssueAlert[];
}

/**
 * 현재 사용자의 역할과 선택된 지역 범위에 따라 접근 가능한 데이터를 반환한다.
 * REGION_ADMIN는 항상 자신의 regionId로만 필터링되며,
 * URL 또는 상태를 조작해도 다른 지역 데이터에 접근할 수 없다.
 */
export function useDataScope(): DataScope {
  const { user, selectedRegionId } = useAuth();
  const isSystemAdmin = user.role === 'SYSTEM_ADMIN';

  const effectiveRegionId = useMemo<RegionId | null>(() => {
    if (!isSystemAdmin) return user.regionId; // REGION_ADMIN: 항상 자신의 지역
    return selectedRegionId; // SYSTEM_ADMIN: null이면 전체, 아니면 선택 지역
  }, [isSystemAdmin, user.regionId, selectedRegionId]);

  const regions = useMemo<Region[]>(
    () => (effectiveRegionId === null ? mockRegions : mockRegions.filter((r) => r.id === effectiveRegionId)),
    [effectiveRegionId],
  );

  const supportRecords = useMemo<SupportRecord[]>(
    () =>
      effectiveRegionId === null
        ? mockSupportRecords
        : mockSupportRecords.filter((r) => r.regionId === effectiveRegionId),
    [effectiveRegionId],
  );

  const inventoryItems = useMemo<InventoryItem[]>(
    () =>
      effectiveRegionId === null
        ? mockInventoryItems
        : mockInventoryItems.filter((item) => item.regionId === effectiveRegionId),
    [effectiveRegionId],
  );

  const dataIssues = useMemo<DataIssueAlert[]>(
    () =>
      effectiveRegionId === null
        ? mockDataIssues
        : mockDataIssues.filter((issue) => !issue.regionId || issue.regionId === effectiveRegionId),
    [effectiveRegionId],
  );

  return { isSystemAdmin, effectiveRegionId, regions, supportRecords, inventoryItems, dataIssues };
}
