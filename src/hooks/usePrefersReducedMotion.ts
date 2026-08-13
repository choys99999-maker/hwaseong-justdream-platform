import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

/**
 * 사용자가 OS 에서 "동작 줄이기"를 켰는지. 시민 지도의 줌인 연출과 핀 등장 애니메이션은
 * 이 값이 true 면 전부 생략하고 최종 상태로 바로 간다(연출이 없어도 정보는 동일하다).
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
