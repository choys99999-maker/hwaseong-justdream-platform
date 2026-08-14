import { useCallback, useEffect, useState } from 'react';
import { isCentralStoreEnabled } from '../lib/supabase';
import { listSiteQuickStatus, type SiteQuickStatus } from '../store/citizenSites';
import { buildCitizenPlaces, type CitizenPlace } from '../data/citizenDirectory';

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
    listSiteQuickStatus()
      .then((overrides: Map<string, SiteQuickStatus>) => {
        setState({ places: buildCitizenPlaces(overrides), isLoading: false });
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
