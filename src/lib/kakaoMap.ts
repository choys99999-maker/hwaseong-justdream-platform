import type { KakaoMapsNamespace } from '../types/kakao';

/**
 * 카카오맵 JavaScript SDK 로더.
 *
 * - 같은 script 태그가 여러 번 삽입되지 않도록 singleton Promise 로 관리한다.
 * - `autoload=false` 로 불러온 뒤 `kakao.maps.load()` 로 초기화한다.
 * - 이미 로드된 경우 기존 `window.kakao.maps` 를 그대로 재사용한다.
 * - 실패하면 캐시된 Promise 를 비워 재시도할 수 있게 한다.
 */

const SDK_URL = '//dapi.kakao.com/v2/maps/sdk.js';
const SCRIPT_ID = 'kakao-maps-sdk';

export class MissingKakaoKeyError extends Error {
  constructor() {
    super('카카오맵 API 키가 설정되지 않았습니다.');
    this.name = 'MissingKakaoKeyError';
  }
}

export const KAKAO_KEY_ENV_NAME = 'VITE_KAKAO_MAP_JAVASCRIPT_KEY';

export function getKakaoAppKey(): string {
  return (import.meta.env.VITE_KAKAO_MAP_JAVASCRIPT_KEY ?? '').trim();
}

export function hasKakaoAppKey(): boolean {
  return getKakaoAppKey().length > 0;
}

let loaderPromise: Promise<KakaoMapsNamespace> | null = null;

export function loadKakaoMaps(): Promise<KakaoMapsNamespace> {
  const existing = window.kakao?.maps;
  // SDK 가 이미 초기화되어 있으면(개발 서버 HMR, 재마운트 등) 그대로 재사용한다.
  if (existing && typeof existing.Map === 'function') {
    return Promise.resolve(existing);
  }

  if (loaderPromise) return loaderPromise;

  const appKey = getKakaoAppKey();
  if (!appKey) return Promise.reject(new MissingKakaoKeyError());

  loaderPromise = new Promise<KakaoMapsNamespace>((resolve, reject) => {
    const fail = (error: Error) => {
      console.error('[kakaoMap] 카카오맵 SDK 로딩 실패', error);
      loaderPromise = null;
      document.getElementById(SCRIPT_ID)?.remove();
      reject(error);
    };

    const initialize = () => {
      const maps = window.kakao?.maps;
      if (!maps) {
        fail(new Error('카카오맵 SDK 를 불러왔지만 kakao.maps 객체를 찾을 수 없습니다.'));
        return;
      }
      try {
        maps.load(() => resolve(maps));
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    };

    const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', initialize, { once: true });
      existingScript.addEventListener(
        'error',
        () => fail(new Error('카카오맵 SDK script 로딩에 실패했습니다. 도메인 등록과 API 키를 확인해 주세요.')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `${SDK_URL}?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.addEventListener('load', initialize, { once: true });
    script.addEventListener(
      'error',
      () => fail(new Error('카카오맵 SDK script 로딩에 실패했습니다. 도메인 등록과 API 키를 확인해 주세요.')),
      { once: true },
    );
    document.head.appendChild(script);
  });

  return loaderPromise;
}

/** 로딩 실패 후 재시도할 때 캐시를 비운다. */
export function resetKakaoMapsLoader(): void {
  loaderPromise = null;
  document.getElementById(SCRIPT_ID)?.remove();
}
