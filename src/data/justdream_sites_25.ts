/**
 * 화성형 그냥드림 사업장 25개소 — 기관명 source of truth.
 *
 * 실적 엑셀에서 확인된 기관명 목록이며, 이 파일의 25건이 기준이다.
 * 임의로 기관을 추가하거나 빼지 않는다.
 *
 * 주소·좌표 확정 (2026-08-07, 1회 실행 후 정적 저장 — 런타임 검색 API 호출 없음)
 * - 수집: `scripts/resolve-justdream-coordinates.mjs`
 *   등록 도메인(localhost:5173)에서 Kakao Maps SDK `services` 라이브러리로 기관명 키워드 검색.
 *   (이 저장소에는 REST API 키가 없어 JS 키 + 헤드리스 브라우저로 1회만 조회했다)
 * - 검증: `scripts/verify-justdream-coordinates.mjs`
 *   25건 전수에 대해 ① 화성시 행정구역 폴리곤 내부 ② 협의체는 해당 읍면동 폴리곤 내부
 *   두 조건을 point-in-polygon 으로 확인했다. 전건 통과.
 *
 * - 복지기관 9곳: 실제 시설 주소 기준
 * - 지역사회보장협의체 16곳: 해당 읍면동 행정복지센터를 운영 위치로 본다
 *
 * 확인이 필요한 항목 (추측하지 않고 검색 결과 그대로 반영)
 * - justdream-12 남양읍: 카카오 등록명이 `남양읍임시행정복지센터` 다. 남양읍 청사가 임시청사
 *   (화성시청역로 36) 로 운영 중이며, 정식 청사 좌표는 별도 확인이 필요하다.
 * - justdream-02 / justdream-21: 동탄4동 복합청사(청계동 530)에 함께 있어 도로명주소가
 *   카카오 장소 정보에 비어 있다. 검색이 돌려준 지번주소를 그대로 저장했다.
 * - justdream-08 / justdream-23: 동탄대로8길 36 (동탄호수공원 복합커뮤니티센터) 동일 건물이라
 *   카카오가 두 기관에 같은 좌표를 준다. 지도에서 마커 2개가 정확히 겹친다.
 */
export type JustDreamSiteSeed = {
  id: string;
  name: string;
  displayName: string;
  category: '복지기관' | '지역사회보장협의체';
  locationStrategy: 'exact_facility' | 'administrative_welfare_center';
  address: string | null;
  lat: number | null;
  lng: number | null;
};

export const JUST_DREAM_SITES_25: JustDreamSiteSeed[] = [
  { id: 'justdream-01', name: '화성시동탄치동천종합사회복지관', displayName: '동탄치동천종합사회복지관', category: '복지기관', locationStrategy: 'exact_facility', address: '경기 화성시 동탄구 동탄순환대로24길 101', lat: 37.206144, lng: 127.122749 },
  { id: 'justdream-02', name: '화성시동탄어울림종합사회복지관', displayName: '동탄어울림종합사회복지관', category: '복지기관', locationStrategy: 'exact_facility', address: '경기 화성시 동탄구 청계동 530', lat: 37.199802, lng: 127.112284 },
  { id: 'justdream-03', name: '화성시서부종합사회복지관', displayName: '서부종합사회복지관', category: '복지기관', locationStrategy: 'exact_facility', address: '경기 화성시 만세구 송산면 사강로 145', lat: 37.213046, lng: 126.73203 },
  { id: 'justdream-04', name: '화성시아르딤복지관', displayName: '아르딤복지관', category: '복지기관', locationStrategy: 'exact_facility', address: '경기 화성시 만세구 향남읍 도이1길 104', lat: 37.13657, lng: 126.920475 },
  { id: 'justdream-05', name: '화성시동탄아르딤복지관', displayName: '동탄아르딤복지관', category: '복지기관', locationStrategy: 'exact_facility', address: '경기 화성시 동탄구 동탄대로10길 17-12', lat: 37.176687, lng: 127.107844 },
  { id: 'justdream-06', name: '화성시남부노인복지관', displayName: '남부노인복지관', category: '복지기관', locationStrategy: 'exact_facility', address: '경기 화성시 만세구 향남읍 토성로 37-22', lat: 37.128853, lng: 126.936166 },
  { id: 'justdream-07', name: '화성시서부노인복지관', displayName: '서부노인복지관', category: '복지기관', locationStrategy: 'exact_facility', address: '경기 화성시 만세구 남양읍 시청로 155', lat: 37.198854, lng: 126.828627 },
  { id: 'justdream-08', name: '화성시동탄노인복지관', displayName: '동탄노인복지관', category: '복지기관', locationStrategy: 'exact_facility', address: '경기 화성시 동탄구 동탄대로8길 36', lat: 37.170548, lng: 127.110457 },
  { id: 'justdream-09', name: '화성시정조효노인복지관', displayName: '정조효노인복지관', category: '복지기관', locationStrategy: 'exact_facility', address: '경기 화성시 병점구 용주로152번길 27', lat: 37.21195, lng: 127.002727 },

  { id: 'justdream-10', name: '우정읍지역사회보장협의체', displayName: '우정읍 협의체', category: '지역사회보장협의체', locationStrategy: 'administrative_welfare_center', address: '경기 화성시 만세구 우정읍 쌍봉로 109-14', lat: 37.08982, lng: 126.815312 },
  { id: 'justdream-11', name: '향남읍지역사회보장협의체', displayName: '향남읍 협의체', category: '지역사회보장협의체', locationStrategy: 'administrative_welfare_center', address: '경기 화성시 만세구 향남읍 발안로 89', lat: 37.132431, lng: 126.920344 },
  { id: 'justdream-12', name: '남양읍지역사회보장협의체', displayName: '남양읍 협의체', category: '지역사회보장협의체', locationStrategy: 'administrative_welfare_center', address: '경기 화성시 만세구 남양읍 화성시청역로 36', lat: 37.19302, lng: 126.821319 },
  { id: 'justdream-13', name: '봉담읍지역사회보장협의체', displayName: '봉담읍 협의체', category: '지역사회보장협의체', locationStrategy: 'administrative_welfare_center', address: '경기 화성시 효행구 봉담읍 샘마을1길 7', lat: 37.220067, lng: 126.949542 },
  { id: 'justdream-14', name: '서신면지역사회보장협의체', displayName: '서신면 협의체', category: '지역사회보장협의체', locationStrategy: 'administrative_welfare_center', address: '경기 화성시 만세구 서신면 궁평항로 1702', lat: 37.166571, lng: 126.708733 },
  { id: 'justdream-15', name: '양감면지역사회보장협의체', displayName: '양감면 협의체', category: '지역사회보장협의체', locationStrategy: 'administrative_welfare_center', address: '경기 화성시 만세구 양감면 초록로 7', lat: 37.081562, lng: 126.945496 },
  { id: 'justdream-16', name: '비봉면지역사회보장협의체', displayName: '비봉면 협의체', category: '지역사회보장협의체', locationStrategy: 'administrative_welfare_center', address: '경기 화성시 효행구 비봉면 비봉로71번길 1', lat: 37.235174, lng: 126.873401 },
  { id: 'justdream-17', name: '새솔동지역사회보장협의체', displayName: '새솔동 협의체', category: '지역사회보장협의체', locationStrategy: 'administrative_welfare_center', address: '경기 화성시 만세구 수노을중앙로 178', lat: 37.281276, lng: 126.818691 },
  { id: 'justdream-18', name: '기배동지역사회보장협의체', displayName: '기배동 협의체', category: '지역사회보장협의체', locationStrategy: 'administrative_welfare_center', address: '경기 화성시 효행구 기안남로 62', lat: 37.224392, lng: 126.984676 },
  { id: 'justdream-19', name: '병점1동지역사회보장협의체', displayName: '병점1동 협의체', category: '지역사회보장협의체', locationStrategy: 'administrative_welfare_center', address: '경기 화성시 병점구 경기대로1010번길 11', lat: 37.20687, lng: 127.037274 },
  { id: 'justdream-20', name: '병점2동지역사회보장협의체', displayName: '병점2동 협의체', category: '지역사회보장협의체', locationStrategy: 'administrative_welfare_center', address: '경기 화성시 병점구 병점3로 99', lat: 37.211478, lng: 127.043022 },
  { id: 'justdream-21', name: '동탄4동지역사회보장협의체', displayName: '동탄4동 협의체', category: '지역사회보장협의체', locationStrategy: 'administrative_welfare_center', address: '경기 화성시 동탄구 청계동 530', lat: 37.199665, lng: 127.112415 },
  { id: 'justdream-22', name: '동탄6동지역사회보장협의체', displayName: '동탄6동 협의체', category: '지역사회보장협의체', locationStrategy: 'administrative_welfare_center', address: '경기 화성시 동탄구 동탄감배산로 54', lat: 37.191509, lng: 127.090226 },
  { id: 'justdream-23', name: '동탄7동지역사회보장협의체', displayName: '동탄7동 협의체', category: '지역사회보장협의체', locationStrategy: 'administrative_welfare_center', address: '경기 화성시 동탄구 동탄대로8길 36', lat: 37.170548, lng: 127.110457 },
  { id: 'justdream-24', name: '동탄8동지역사회보장협의체', displayName: '동탄8동 협의체', category: '지역사회보장협의체', locationStrategy: 'administrative_welfare_center', address: '경기 화성시 동탄구 동탄대로 87', lat: 37.162299, lng: 127.105276 },
  { id: 'justdream-25', name: '동탄9동지역사회보장협의체', displayName: '동탄9동 협의체', category: '지역사회보장협의체', locationStrategy: 'administrative_welfare_center', address: '경기 화성시 동탄구 동탄신리천로9길 76', lat: 37.18065, lng: 127.138383 },
];
