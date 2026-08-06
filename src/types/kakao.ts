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

export interface KakaoMap {
  setBounds(bounds: KakaoLatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): void;
  setCenter(latlng: KakaoLatLng): void;
  getCenter(): KakaoLatLng;
  setLevel(level: number): void;
  getLevel(): number;
  relayout(): void;
  addControl(control: KakaoZoomControl, position: unknown): void;
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
  CustomOverlay: new (options: KakaoCustomOverlayOptions) => KakaoCustomOverlay;
  event: {
    addListener(target: object, type: string, handler: (...args: unknown[]) => void): void;
    removeListener(target: object, type: string, handler: (...args: unknown[]) => void): void;
  };
  load(callback: () => void): void;
}

declare global {
  interface Window {
    kakao?: { maps?: KakaoMapsNamespace };
  }
}
