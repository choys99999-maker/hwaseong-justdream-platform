/**
 * 지도 구현(카카오 / SDK 없는 대체 지도)이 공유하는 타입.
 * 두 컴포넌트가 서로를 import 하지 않도록 여기에 둔다.
 */

/**
 * 검색 결과 선택 등 외부에서 특정 거점으로 지도를 이동시키고 싶을 때 쓴다.
 * token 을 매번 올려 같은 거점을 다시 선택해도 이동이 재실행되게 한다.
 */
export interface MapFocusRequest {
  siteId: string;
  token: number;
  /** true 면 center 이동만 하고 zoom 레벨은 바꾸지 않는다. 마커 직접 클릭 시 사용. */
  panOnly?: boolean;
}
