import type { KakaoMapsNamespace } from '../types/kakao';

/**
 * 카카오맵 JavaScript SDK 로더.
 *
 * - 같은 script 태그가 여러 번 삽입되지 않도록 singleton Promise 로 관리한다.
 * - `autoload=false` 로 불러온 뒤 `kakao.maps.load()` 로 초기화한다.
 * - 이미 로드된 경우 기존 `window.kakao.maps` 를 그대로 재사용한다.
 * - 실패하면 캐시된 Promise 를 비워 재시도할 수 있게 한다.
 *
 * 왜 timeout 이 필요한가
 * ----------------------
 * 카카오 SDK 는 "키는 유효하지만 실행 도메인이 등록되지 않은" 경우에도 sdk.js 자체는 200 으로
 * 내려온다. 그 뒤 `kakao.maps.load(cb)` 가 내부적으로 받아 오는 리소스가 401 로 막히는데,
 * 이때 콜백이 **영영 호출되지 않고 에러 이벤트도 뜨지 않는다**. 그러면 화면은 "지도를 불러오는
 * 중입니다…" 스피너에 갇힌다. 실패를 알 수 있는 유일한 방법이 시간뿐이라 watchdog 을 둔다.
 */

const SDK_URL = 'https://dapi.kakao.com/v2/maps/sdk.js';
const SCRIPT_ID = 'kakao-maps-sdk';

/** 이 시간 안에 `kakao.maps.load()` 콜백이 오지 않으면 실패로 본다. */
const SDK_TIMEOUT_MS = 8_000;

export class MissingKakaoKeyError extends Error {
  constructor() {
    super('카카오맵 API 키가 설정되지 않았습니다.');
    this.name = 'MissingKakaoKeyError';
  }
}

/** SDK 응답이 끝내 오지 않은 경우. 대부분 도메인 미등록이거나 네트워크가 막힌 상황이다. */
export class KakaoMapTimeoutError extends Error {
  constructor() {
    super(
      '카카오맵 SDK 응답이 없습니다. 카카오 개발자 사이트 [플랫폼 > Web] 에 현재 도메인이 등록돼 있는지 확인해 주세요.',
    );
    this.name = 'KakaoMapTimeoutError';
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
    let settled = false;

    const cleanupCache = () => {
      loaderPromise = null;
      document.getElementById(SCRIPT_ID)?.remove();
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      console.error('[kakaoMap] 카카오맵 SDK 로딩 실패', error);
      cleanupCache();
      reject(error);
    };

    const succeed = (maps: KakaoMapsNamespace) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(maps);
    };

    // script 의 load/error 어느 쪽도 오지 않는 경우(도메인 미등록 등)를 시간으로 잡는다.
    const timer = window.setTimeout(() => fail(new KakaoMapTimeoutError()), SDK_TIMEOUT_MS);

    const initialize = () => {
      const maps = window.kakao?.maps;
      if (!maps) {
        fail(new Error('카카오맵 SDK 를 불러왔지만 kakao.maps 객체를 찾을 수 없습니다.'));
        return;
      }
      try {
        maps.load(() => succeed(maps));
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    };

    const onScriptError = () =>
      fail(
        new Error('카카오맵 SDK script 로딩에 실패했습니다. 도메인 등록과 API 키를 확인해 주세요.'),
      );

    const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      // 이미 load 가 끝난 script 라면 새 리스너는 영영 호출되지 않는다 — 바로 초기화한다.
      if (existingScript.dataset.loaded === 'true') {
        initialize();
        return;
      }
      existingScript.addEventListener(
        'load',
        () => {
          existingScript.dataset.loaded = 'true';
          initialize();
        },
        { once: true },
      );
      existingScript.addEventListener('error', onScriptError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `${SDK_URL}?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        initialize();
      },
      { once: true },
    );
    script.addEventListener('error', onScriptError, { once: true });
    document.head.appendChild(script);
  });

  return loaderPromise;
}

/** 로딩 실패 후 재시도할 때 캐시를 비운다. */
export function resetKakaoMapsLoader(): void {
  loaderPromise = null;
  document.getElementById(SCRIPT_ID)?.remove();
}
