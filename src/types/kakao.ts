/**
 * 카카오맵 JavaScript SDK 중 이 프로젝트에서 실제로 쓰는 API만 선언한다.
 * 전역 any 를 늘리지 않기 위해 필요한 최소 범위만 정의했다.
 */

export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

export interface KakaoLatLngBounds {
  extend(latlng: KakaoLatLng): void;
  isEmpty(): boolean;
  getSouthWest(): KakaoLatLng;
  getNorthEast(): KakaoLatLng;
}

/** `setLevel` 의 애니메이션 옵션. 시민 지도의 "부드러운 줌인" 연출이 이걸 쓴다. */
export interface KakaoSetLevelOptions {
  anchor?: KakaoLatLng;
  animate?: boolean | { duration?: number };
}

export interface KakaoPoint {
  x: number;
  y: number;
}

export interface KakaoProjection {
  /** 지도 컨테이너 내 화면 픽셀 좌표 → 지도 좌표 변환 */
  coordsFromContainerPoint(point: KakaoPoint): KakaoLatLng;
  /** 지도 좌표 → 컨테이너 내 화면 픽셀 좌표 변환 */
  containerPointFromCoords(latlng: KakaoLatLng): KakaoPoint;
}

export interface KakaoMap {
  setBounds(bounds: KakaoLatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): void;
  setCenter(latlng: KakaoLatLng): void;
  getCenter(): KakaoLatLng;
  /** 지금 화면에 보이는 영역. */
  getBounds(): KakaoLatLngBounds;
  /** 중심을 부드럽게 이동한다. */
  panTo(latlng: KakaoLatLng): void;
  setLevel(level: number, options?: KakaoSetLevelOptions): void;
  getLevel(): number;
  relayout(): void;
  addControl(control: KakaoZoomControl, position: unknown): void;
  /** 현재 지도의 좌표↔화면픽셀 변환기 */
  getProjection(): KakaoProjection;
}

export interface KakaoPolygonOptions {
  path?: KakaoLatLng[] | KakaoLatLng[][];
  strokeWeight?: number;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeStyle?: string;
  fillColor?: string;
  fillOpacity?: number;
  zIndex?: number;
}

export interface KakaoPolygon {
  setMap(map: KakaoMap | null): void;
  setOptions(options: KakaoPolygonOptions): void;
  setZIndex(zIndex: number): void;
}

export interface KakaoPolylineOptions {
  path?: KakaoLatLng[];
  strokeWeight?: number;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeStyle?: string;
  zIndex?: number;
}

export interface KakaoPolyline {
  setMap(map: KakaoMap | null): void;
  setOptions(options: KakaoPolylineOptions): void;
  setZIndex(zIndex: number): void;
}

export interface KakaoCustomOverlayOptions {
  position: KakaoLatLng;
  content: HTMLElement | string;
  xAnchor?: number;
  yAnchor?: number;
  zIndex?: number;
  clickable?: boolean;
  map?: KakaoMap | null;
}

export interface KakaoCustomOverlay {
  setMap(map: KakaoMap | null): void;
  setZIndex(zIndex: number): void;
}

export type KakaoZoomControl = object;

export interface KakaoMapsNamespace {
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new (sw?: KakaoLatLng, ne?: KakaoLatLng) => KakaoLatLngBounds;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number; draggable?: boolean }) => KakaoMap;
  ZoomControl: new () => KakaoZoomControl;
  ControlPosition: Record<string, unknown>;
  Polygon: new (options: KakaoPolygonOptions) => KakaoPolygon;
  Polyline: new (options: KakaoPolylineOptions) => KakaoPolyline;
  CustomOverlay: new (options: KakaoCustomOverlayOptions) => KakaoCustomOverlay;
  event: {
    addListener(target: object, type: string, handler: (...args: unknown[]) => void): void;
    removeListener(target: object, type: string, handler: (...args: unknown[]) => void): void;
    preventMap(): void;
  };
  load(callback: () => void): void;
}

declare global {
  interface Window {
    kakao?: { maps?: KakaoMapsNamespace };
  }
}
