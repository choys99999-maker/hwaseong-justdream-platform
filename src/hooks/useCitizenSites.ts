import { useCallback, useEffect, useState } from 'react';
import { isCentralStoreEnabled } from '../lib/supabase';
import { listSiteQuickStatus, type SiteQuickStatus } from '../store/citizenSites';
import { buildCitizenSites, type CitizenSite } from '../utils/citizenSite';

interface State {
  sites: CitizenSite[];
  isLoading: boolean;
}

/**
 * 시민 화면용 거점 25곳. 이름·주소·좌표는 항상 뜬다(중앙 저장소 연결과 무관) —
 * "지금 상태"만 `site_quick_status`에서 덧씌운다. 그 표가 아직 비어 있거나
 * 중앙 저장소 연결이 안 돼 있어도 시연 기본값으로 항상 3곳을 보여줄 수 있어야 하므로,
 * 여기서 나는 오류는 화면을 막지 않고 조용히 기본값으로 대체한다.
 */
export function useCitizenSites() {
  const [state, setState] = useState<State>({ sites: buildCitizenSites(new Map()), isLoading: true });

  const refresh = useCallback(() => {
    if (!isCentralStoreEnabled) {
      setState({ sites: buildCitizenSites(new Map()), isLoading: false });
      return;
    }
    setState((prev) => ({ ...prev, isLoading: true }));
    listSiteQuickStatus()
      .then((overrides: Map<string, SiteQuickStatus>) => {
        setState({ sites: buildCitizenSites(overrides), isLoading: false });
      })
      .catch(() => {
        // 표가 아직 없거나(마이그레이션 전) 일시적 오류 — 시연 기본값으로 계속 보여준다.
        setState({ sites: buildCitizenSites(new Map()), isLoading: false });
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 시연에서 현장 담당자 화면을 다른 탭/창으로 열어 상태를 바꾼 뒤 돌아오는 경우가 있다.
  // 역할 전환이 라우트 이동이면 재마운트로 이미 갱신되지만, 탭 복귀 경로도 함께 막아 둔다.
  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState === 'visible') refresh();
    }
    document.addEventListener('visibilitychange', handleVisible);
    return () => document.removeEventListener('visibilitychange', handleVisible);
  }, [refresh]);

  return { ...state, refresh };
}
