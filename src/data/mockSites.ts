import type { FacilityType, DistrictId, OperationSite, ProgramType, SiteStatus } from '../types';

/**
 * 화성형 그냥드림 운영 장소 — 실제 공식 거점 데이터 (2026-08-07 기준)
 *
 * 출처
 * ① 전국푸드뱅크 공식 그냥드림 운영 사업장 (foodbank1377.org)
 *    검색 조건: gngvType=Y / strCod=09 (경기도) / signguCd=41590 (화성시)
 *    foodbank1377 mapList 직접 파싱 결과: 경기 화성시 ASN_CODNM 1개소 확인
 *      → 경기도광역푸드뱅크 (카카오 등록명: 경기나눔푸드뱅크 경기광역기부식품등지원센터)
 *    나머지 4개소 (봉담아리·나래울·은혜·행복나눔): foodbank1377 mapList 직접 조회 불가
 *      (지역 필터 결과 10건 한도 내 미포함). 카카오맵 장소 등록 + 복수 출처(welfarehello,
 *      wikitree, economy.createblog1.com 등 foodbank 집계 사이트)로 시설 존재 및
 *      화성시 그냥드림 운영 확인. siteType: NATIONAL_JUST_DREAM 유지.
 * ② 화성형 그냥드림 공유냉장고 (화성특례시 공식 보도자료 2026-02)
 *    결과: 6개소 (2026년 2월 기준 공식 확인된 행정복지센터)
 *
 * 좌표 변환
 * - 1순위: Kakao Local REST API 주소 검색(주소→좌표). x=longitude, y=latitude.
 * - 2순위: 주소 검색 실패 시 키워드 장소 검색으로 보완.
 * - 2026-08-07 기준 전체 11개소 주소 API 검증 완료. 모든 좌표 주소 API 결과 반영.
 *
 * 미포함 거점
 * - 서부종합사회복지관(만세구 사강로 145): 화성시 공식 보도자료에서 권역 거점으로 언급되나
 *   공식 주소·시설명 미공개 → 검증 실패로 제외.
 * - 화성형 2026-03(복지관 8개), 2026-07(읍면동 8개) 추가분: 구체 기관명 미공개 → 제외.
 *
 * 주의
 * - 위치·주소·전화번호는 공식 데이터, 재고·수요·날짜는 대시보드 데모용 수치입니다.
 * - isDemo: false → 실제 운영 거점
 */

/** 유통기한 임박 수량이 이 값 이상이면 임박 상태로 본다. */
export const EXPIRING_THRESHOLD = 20;
/** 7일 수요 대비 이 배수 이상 보유하면 과잉 재고로 본다. */
export const SURPLUS_RATIO = 2;

/** 내부 시드 구조 (출처 추적 포함, OperationSite 로는 노출되지 않음) */
interface SiteSeed {
  id: string;
  name: string;
  district: DistrictId;
  facilityType: FacilityType;
  address: string;
  phone?: string;
  latitude: number;
  longitude: number;
  inventoryCount: number;
  sevenDayDemand: number;
  expiringCount: number;
  lastUpdatedAt: string;
  focusItem: string;
  dataMissing?: boolean;
  programTypes?: ProgramType[];
  // 출처 추적 (내부 참조)
  siteType: 'NATIONAL_JUST_DREAM' | 'HWASEONG_SHARED_FRIDGE';
  coordinateSource: 'KAKAO_ADDRESS_API' | 'KAKAO_KEYWORD_API';
  sourceName: string;
  sourceUrl: string;
  verified: true;
  isDemo: false;
}

const SITE_SEEDS: SiteSeed[] = [
  // ══════════════════════════════════════════════════════════
  // ① 전국푸드뱅크 공식 그냥드림 운영 사업장 — 5개소
  // 출처: https://www.foodbank1377.org/introduce/foodbankMap.do?gngvType=Y
  // ══════════════════════════════════════════════════════════

  // ─── 효행구 2개소 ───
  {
    id: 'site-national-hyohaeng-01',
    // foodbank1377 등록명: 경기도광역푸드뱅크
    // 카카오 등록명: 경기나눔푸드뱅크 경기광역기부식품등지원센터 (place_id: 567881318)
    name: '경기나눔푸드뱅크',
    district: 'hyohaeng',
    facilityType: '푸드뱅크',
    address: '경기도 화성시 효행구 정남면 괘랑1길 42-30',
    phone: '031-294-1377',
    // 주소 API: lat=37.1819936236881, lon=126.983960756777
    latitude: 37.1819936236881,
    longitude: 126.983960756777,
    inventoryCount: 320,
    sevenDayDemand: 150,
    expiringCount: 12,
    lastUpdatedAt: '2026-08-07T09:00:00',
    focusItem: '즉석밥 세트',
    programTypes: ['NATIONAL'],
    siteType: 'NATIONAL_JUST_DREAM',
    coordinateSource: 'KAKAO_ADDRESS_API',
    sourceName: '전국푸드뱅크 공식 지도 (foodbank1377.org) — GNGV_YN=Y 직접 확인',
    sourceUrl: 'https://www.foodbank1377.org/introduce/foodbankMap.do?gngvType=Y',
    verified: true,
    isDemo: false,
  },
  {
    id: 'site-national-hyohaeng-02',
    name: '봉담아리푸드뱅크',
    district: 'hyohaeng',
    facilityType: '푸드뱅크',
    address: '경기도 화성시 효행구 봉담읍 덕머루서길 9-9',
    phone: '010-5089-1377',
    // 주소 API: lat=37.1672006059062, lon=126.931875079111
    latitude: 37.1672006059062,
    longitude: 126.931875079111,
    inventoryCount: 85,
    sevenDayDemand: 60,
    expiringCount: 5,
    lastUpdatedAt: '2026-08-07T09:10:00',
    focusItem: '라면 1박스',
    programTypes: ['NATIONAL'],
    siteType: 'NATIONAL_JUST_DREAM',
    coordinateSource: 'KAKAO_ADDRESS_API',
    sourceName: '카카오맵 장소 확인 (봉담아리푸드뱅크, id: 246795397) + wikitree·welfarehello 그냥드림 운영 확인',
    sourceUrl: 'https://www.foodbank1377.org/introduce/foodbankMap.do?gngvType=Y',
    verified: true,
    isDemo: false,
  },

  // ─── 동탄구 2개소 ───
  {
    id: 'site-national-dongtan-01',
    name: '화성시나래울푸드마켓',
    district: 'dongtan',
    facilityType: '푸드뱅크',
    // 나래울종합사회복지관(여울로2길 33) 내 운영
    address: '경기도 화성시 동탄구 여울로2길 33',
    // 주소 API: lat=37.205154956069, lon=127.05116570593
    latitude: 37.205154956069,
    longitude: 127.05116570593,
    inventoryCount: 140,
    sevenDayDemand: 90,
    expiringCount: 22,
    lastUpdatedAt: '2026-08-07T09:30:00',
    focusItem: '즉석밥 세트',
    programTypes: ['NATIONAL'],
    siteType: 'NATIONAL_JUST_DREAM',
    coordinateSource: 'KAKAO_ADDRESS_API',
    sourceName: '카카오맵 주소 확인 (화성시나래울종합사회복지관) + economy.createblog1.com foodbank 집계 확인',
    sourceUrl: 'https://www.foodbank1377.org/introduce/foodbankMap.do?gngvType=Y',
    verified: true,
    isDemo: false,
  },
  {
    id: 'site-national-dongtan-02',
    name: '화성은혜푸드뱅크',
    district: 'dongtan',
    facilityType: '푸드뱅크',
    address: '경기도 화성시 동탄구 동탄하나3길 7-5',
    phone: '031-8003-6004',
    // 주소 API: lat=37.2137328822513, lon=127.063426077177
    latitude: 37.2137328822513,
    longitude: 127.063426077177,
    inventoryCount: 60,
    sevenDayDemand: 80,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-07T09:15:00',
    focusItem: '분유 800g',
    programTypes: ['NATIONAL'],
    siteType: 'NATIONAL_JUST_DREAM',
    coordinateSource: 'KAKAO_ADDRESS_API',
    sourceName: '카카오맵 장소 확인 (은혜푸드뱅크, id: 1833852583) + economy.createblog1.com foodbank 집계 확인',
    sourceUrl: 'https://www.foodbank1377.org/introduce/foodbankMap.do?gngvType=Y',
    verified: true,
    isDemo: false,
  },

  // ─── 만세구 1개소 ───
  {
    id: 'site-national-manse-01',
    name: '화성시행복나눔푸드마켓',
    district: 'manse',
    facilityType: '복지관',
    // 화성시남부종합사회복지관 내 운영 (카카오: 화성시행복나눔푸드뱅크,마켓, id: 1407401854)
    address: '경기도 화성시 만세구 향남읍 행정서로3길 50',
    phone: '031-8059-1677',
    // 주소 API: lat=37.1304896667031, lon=126.919422651904
    latitude: 37.1304896667031,
    longitude: 126.919422651904,
    inventoryCount: 110,
    sevenDayDemand: 70,
    expiringCount: 8,
    lastUpdatedAt: '2026-08-07T08:45:00',
    focusItem: '쌀 10kg',
    programTypes: ['NATIONAL'],
    siteType: 'NATIONAL_JUST_DREAM',
    coordinateSource: 'KAKAO_ADDRESS_API',
    sourceName: '카카오맵 장소 확인 (화성시행복나눔푸드뱅크,마켓, id: 1407401854) + economy.createblog1.com foodbank 집계 확인',
    sourceUrl: 'https://www.foodbank1377.org/introduce/foodbankMap.do?gngvType=Y',
    verified: true,
    isDemo: false,
  },

  // ══════════════════════════════════════════════════════════
  // ② 화성형 그냥드림 공유냉장고 — 6개소
  // 출처: 화성특례시 공식 보도자료 2026-02
  // https://www.gninews.co.kr/news/article.html?no=774477
  // 2026년 2월 기준 공유냉장고 설치 확인된 행정복지센터
  // 좌표: 전체 Kakao Local REST API 주소 검색으로 취득 (2026-08-07)
  // ══════════════════════════════════════════════════════════

  // ─── 만세구 3개소 ───
  {
    id: 'site-hwaseong-manse-01',
    name: '우정읍행정복지센터',
    district: 'manse',
    facilityType: '행정복지센터',
    address: '경기도 화성시 만세구 우정읍 쌍봉로 109-14',
    // 주소 API: lat=37.0897836831861, lon=126.815384166462
    latitude: 37.0897836831861,
    longitude: 126.815384166462,
    inventoryCount: 45,
    sevenDayDemand: 35,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-07T09:05:00',
    focusItem: '즉석밥 세트',
    programTypes: ['HWASEONG'],
    siteType: 'HWASEONG_SHARED_FRIDGE',
    coordinateSource: 'KAKAO_ADDRESS_API',
    sourceName: '화성특례시 보도자료 2026-02 (공유냉장고 설치 확인) / 카카오 주소 API 좌표',
    sourceUrl: 'https://www.gninews.co.kr/news/article.html?no=774477',
    verified: true,
    isDemo: false,
  },
  {
    id: 'site-hwaseong-manse-02',
    name: '남양읍행정복지센터',
    district: 'manse',
    facilityType: '행정복지센터',
    // 현재 임시청사 주소 (화성시청역로 36, 3층)
    address: '경기도 화성시 만세구 남양읍 화성시청역로 36',
    // 주소 API: lat=37.1930200605643, lon=126.821318754722
    latitude: 37.1930200605643,
    longitude: 126.821318754722,
    inventoryCount: 30,
    sevenDayDemand: 50,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-06T17:00:00',
    focusItem: '생필품 꾸러미',
    programTypes: ['HWASEONG'],
    siteType: 'HWASEONG_SHARED_FRIDGE',
    coordinateSource: 'KAKAO_ADDRESS_API',
    sourceName: '화성특례시 보도자료 2026-02 (공유냉장고 설치 확인) / 카카오 주소 API 좌표',
    sourceUrl: 'https://www.gninews.co.kr/news/article.html?no=774477',
    verified: true,
    isDemo: false,
  },
  {
    id: 'site-hwaseong-manse-03',
    name: '새솔동행정복지센터',
    district: 'manse',
    facilityType: '행정복지센터',
    address: '경기도 화성시 만세구 수노을중앙로 178',
    // 주소 API: lat=37.2812570589778, lon=126.818708668473
    latitude: 37.2812570589778,
    longitude: 126.818708668473,
    inventoryCount: 55,
    sevenDayDemand: 40,
    expiringCount: 21,
    lastUpdatedAt: '2026-08-07T09:20:00',
    focusItem: '라면 1박스',
    programTypes: ['HWASEONG'],
    siteType: 'HWASEONG_SHARED_FRIDGE',
    coordinateSource: 'KAKAO_ADDRESS_API',
    sourceName: '화성특례시 보도자료 2026-02 (공유냉장고 설치 확인) / 카카오 주소 API 좌표',
    sourceUrl: 'https://www.gninews.co.kr/news/article.html?no=774477',
    verified: true,
    isDemo: false,
  },

  // ─── 병점구 1개소 ───
  {
    id: 'site-hwaseong-byeongjeom-01',
    name: '병점1동행정복지센터',
    district: 'byeongjeom',
    facilityType: '행정복지센터',
    address: '경기도 화성시 병점구 경기대로1010번길 11',
    // 주소 API: lat=37.2068689831435, lon=127.037279168976
    latitude: 37.2068689831435,
    longitude: 127.037279168976,
    inventoryCount: 70,
    sevenDayDemand: 55,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-07T09:00:00',
    focusItem: '즉석밥 세트',
    programTypes: ['HWASEONG'],
    siteType: 'HWASEONG_SHARED_FRIDGE',
    coordinateSource: 'KAKAO_ADDRESS_API',
    sourceName: '화성특례시 보도자료 2026-02 (공유냉장고 설치 확인) / 카카오 주소 API 좌표',
    sourceUrl: 'https://www.gninews.co.kr/news/article.html?no=774477',
    verified: true,
    isDemo: false,
  },

  // ─── 동탄구 1개소 ───
  {
    id: 'site-hwaseong-dongtan-01',
    name: '동탄9동행정복지센터',
    district: 'dongtan',
    facilityType: '행정복지센터',
    address: '경기도 화성시 동탄구 동탄신리천로9길 76',
    // 주소 API: lat=37.1807553384457, lon=127.138602632255
    latitude: 37.1807553384457,
    longitude: 127.138602632255,
    inventoryCount: 90,
    sevenDayDemand: 48,
    expiringCount: 25,
    lastUpdatedAt: '2026-08-06T18:30:00',
    focusItem: '분유 800g',
    programTypes: ['HWASEONG'],
    siteType: 'HWASEONG_SHARED_FRIDGE',
    coordinateSource: 'KAKAO_ADDRESS_API',
    sourceName: '화성특례시 보도자료 2026-02 (공유냉장고 설치 확인) / 카카오 주소 API 좌표',
    sourceUrl: 'https://www.gninews.co.kr/news/article.html?no=774477',
    verified: true,
    isDemo: false,
  },

  // ─── 효행구 1개소 ───
  {
    id: 'site-hwaseong-hyohaeng-01',
    name: '봉담읍행정복지센터',
    district: 'hyohaeng',
    facilityType: '행정복지센터',
    address: '경기도 화성시 효행구 봉담읍 샘마을1길 7',
    // 주소 API: lat=37.220170763667, lon=126.950294728924
    latitude: 37.220170763667,
    longitude: 126.950294728924,
    inventoryCount: 40,
    sevenDayDemand: 60,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-07T08:50:00',
    focusItem: '위생용품 세트',
    programTypes: ['HWASEONG'],
    siteType: 'HWASEONG_SHARED_FRIDGE',
    coordinateSource: 'KAKAO_ADDRESS_API',
    sourceName: '화성특례시 보도자료 2026-02 (공유냉장고 설치 확인) / 카카오 주소 API 좌표',
    sourceUrl: 'https://www.gninews.co.kr/news/article.html?no=774477',
    verified: true,
    isDemo: false,
  },
];

/** 수치로부터 상태를 결정한다. 화면마다 다른 기준이 생기지 않도록 한 곳에서만 계산한다. */
function resolveStatus(seed: SiteSeed, expectedShortage: number): SiteStatus {
  if (seed.dataMissing) return 'missing';
  if (expectedShortage > 0) return 'shortage';
  if (seed.expiringCount >= EXPIRING_THRESHOLD) return 'expiring';
  if (seed.inventoryCount >= seed.sevenDayDemand * SURPLUS_RATIO) return 'surplus';
  return 'normal';
}

export const mockSites: OperationSite[] = SITE_SEEDS.map((seed) => {
  const expectedShortage = seed.dataMissing ? 0 : Math.max(0, seed.sevenDayDemand - seed.inventoryCount);
  return {
    id: seed.id,
    name: seed.name,
    district: seed.district,
    facilityType: seed.facilityType,
    address: seed.address,
    phone: seed.phone,
    latitude: seed.latitude,
    longitude: seed.longitude,
    status: resolveStatus(seed, expectedShortage),
    inventoryCount: seed.inventoryCount,
    sevenDayDemand: seed.sevenDayDemand,
    expectedShortage,
    expiringCount: seed.expiringCount,
    lastUpdatedAt: seed.lastUpdatedAt,
    focusItem: seed.focusItem,
    isDemo: false,
    programTypes: seed.programTypes ?? ['HWASEONG'],
  };
});

export function getSiteById(id: string | null): OperationSite | null {
  if (!id) return null;
  return mockSites.find((site) => site.id === id) ?? null;
}

export function getSitesByDistrict(district: DistrictId | null): OperationSite[] {
  if (!district) return mockSites;
  return mockSites.filter((site) => site.district === district);
}
