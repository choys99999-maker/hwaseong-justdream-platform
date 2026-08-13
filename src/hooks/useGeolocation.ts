import { useCallback, useState } from 'react';
import type { LatLng } from '../lib/geo';

export type GeolocationStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unsupported' | 'error';

interface GeolocationState {
  status: GeolocationStatus;
  coords: LatLng | null;
}

/**
 * "내 주변에서 찾기" 버튼이 누른 시점에만 위치를 요청한다(자동 요청 없음).
 * 거부·미지원이면 시민 홈이 "사는 동네 선택하기"로 계속 진행할 수 있도록 상태만 알려준다.
 */
export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({ status: 'idle', coords: null });

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'unsupported', coords: null });
      return;
    }
    setState({ status: 'locating', coords: null });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          status: 'granted',
          coords: { lat: position.coords.latitude, lng: position.coords.longitude },
        });
      },
      (err) => {
        setState({
          status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error',
          coords: null,
        });
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  return { ...state, request };
}
