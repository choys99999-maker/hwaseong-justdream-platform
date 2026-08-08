import { useEffect, useState } from 'react';
import { isCentralStoreEnabled } from '../lib/supabase';

interface State<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

/**
 * 중앙 DB 조회용 최소 훅. 화면에 들어올 때 한 번 읽는다.
 * (Realtime 없이 페이지 진입 시 refetch로 충분하다)
 */
export function useCentralData<T>(loader: () => Promise<T>, deps: unknown[]): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, error: null, isLoading: true });

  // deps는 호출부가 넘겨준 배열을 그대로 쓴다. (loader는 매 렌더 새로 만들어지므로 제외)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isCentralStoreEnabled) {
      setState({
        data: null,
        error: '중앙 저장소가 설정되지 않았습니다. 환경변수를 확인해 주세요.',
        isLoading: false,
      });
      return;
    }

    let cancelled = false;
    setState({ data: null, error: null, isLoading: true });

    loader()
      .then((data) => {
        if (!cancelled) setState({ data, error: null, isLoading: false });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          data: null,
          error: err instanceof Error ? err.message : '데이터를 불러오지 못했습니다.',
          isLoading: false,
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
