import { useCallback, useEffect, useState } from 'react';
import { isCentralStoreEnabled } from '../lib/supabase';
import { listSiteQuickStatus } from '../store/citizenSites';
import { listInventoryStatus, type InventoryStatus } from '../store/analytics';
import { buildCitizenPlaces, type CitizenPlace, type LiveInventoryData, type PlaceItem, type ItemGroup } from '../data/citizenDirectory';

// ── v_inventory_status → PlaceItem 변환 ──────────────────────────────────────

/**
 * 품목명으로 분류를 유추한다.
 * inventory_records 에 category 열이 없어 이름 패턴만 쓸 수 있다.
 * 패턴이 없으면 'living'(생활용품)을 기본값으로 한다.
 */
function inferItemGroup(name: string): ItemGroup {
  const n = name.normalize('NFC').toLowerCase();
  if (/쌀|밥|라면|분유|통조림|빵|국수|죽|시리얼|과자|식품/.test(n)) return 'food';
  if (/위생|생리|마스크|비누|샴푸|칫솔|치약|손소독|세정/.test(n)) return 'hygiene';
  return 'living';
}

function inventoryRowToPlaceItem(row: InventoryStatus): PlaceItem | null {
  // 이상 품목(확인 필요)·재고 없는 품목은 시민 화면에 노출하지 않는다
  if (row.hasAnomaly || row.stock === null || row.stock <= 0) return null;
  return {
    id: `live::${row.organizationId}::${row.itemName}`,
    name: row.itemName,
    category: inferItemGroup(row.itemName),
    level: row.status === '부족' ? 'few' : 'some',
  };
}

function buildLiveInventoryMap(statuses: InventoryStatus[]): Map<string, LiveInventoryData> {
  const map = new Map<string, LiveInventoryData>();
  for (const row of statuses) {
    const item = inventoryRowToPlaceItem(row);
    let entry = map.get(row.organizationName);
    if (!entry) {
      entry = { items: [], updatedAt: null };
      map.set(row.organizationName, entry);
    }
    if (item) entry.items.push(item);
    // 같은 기관의 품목 중 가장 최근 제출 시각을 갱신 기준으로 쓴다
    if (row.lastReportedAt && (!entry.updatedAt || row.lastReportedAt > entry.updatedAt)) {
      entry.updatedAt = row.lastReportedAt;
    }
  }
  return map;
}

interface State {
  places: CitizenPlace[];
  isLoading: boolean;
}

/**
 * 시민 화면 전체가 쓰는 거점 목록 하나.
 *
 * 이름·주소·좌표는 중앙 저장소 연결과 무관하게 항상 뜬다 — "지금 상태" 만
 * `site_quick_status` 로 덧씌운다. 표가 아직 없거나 연결이 끊겨도 화면을 막지 않고
 * 조용히 기본값으로 계속 보여준다(빈 지도를 보여주는 것이 최악이다).
 */
export function useCitizenPlaces() {
  const [state, setState] = useState<State>({ places: buildCitizenPlaces(new Map()), isLoading: true });

  const refresh = useCallback(() => {
    if (!isCentralStoreEnabled) {
      setState({ places: buildCitizenPlaces(new Map()), isLoading: false });
      return;
    }
    setState((prev) => ({ ...prev, isLoading: true }));
    Promise.all([
      listSiteQuickStatus(),
      // 인벤토리 조회 실패는 치명적이지 않다 — 빈 배열로 조용히 계속 표시한다
      listInventoryStatus().catch(() => [] as InventoryStatus[]),
    ])
      .then(([overrides, inventoryRows]) => {
        const liveInventory = buildLiveInventoryMap(inventoryRows);
        setState({ places: buildCitizenPlaces(overrides, liveInventory), isLoading: false });
      })
      .catch(() => {
        setState({ places: buildCitizenPlaces(new Map()), isLoading: false });
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 시연 중 다른 탭에서 현장 담당자가 상태를 바꾸고 돌아오는 경로도 갱신한다.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') refresh();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  return { ...state, refresh };
}
