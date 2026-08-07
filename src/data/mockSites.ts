import type { FacilityType, DistrictId, OperationSite, ProgramType, SiteStatus } from '../types';

/**
 * 화성형 그냥드림 운영 장소 합성 데이터 (MVP 데모용) — 실제 운영 장소 기준 39개소.
 *
 * 집계 기준
 * - 화성형 38개 프로그램 (읍면동 행정복지센터 29 + 복지관 등 추가 거점 9)
 * - 국가형 5개 프로그램
 * - 동시 운영 장소 4곳 → 실제 운영 장소 38 + 1(국가형 전용) = 39곳
 * - 전체 프로그램 = 38 + 5 = 43개
 *
 * 주의
 * - 모든 수치·좌표·주소는 합성 데이터입니다. 실제 운영 데이터가 아닙니다.
 * - 시설명은 실제 행정동 명칭을 참고했고, 좌표는 행정동 경계 중심점을 사용한 데모 값입니다.
 *   실제 청사 위치가 아니므로 모든 거점을 isDemo: true 로 표시합니다.
 * - 구(DistrictId) 소속은 src/data/geo/README.md 의 sggnm 값을 따랐습니다.
 *
 * TODO(synthetic-dual-operation): 동시 운영(HWASEONG+NATIONAL) 지정 근거
 *   우정읍·정남면·진안동·동탄4동 4곳을 화성형+국가형 동시 운영으로 지정한 것은
 *   실제 사업 집행 자료 없이 **데모 목적으로 임의 지정**한 합성 데이터입니다.
 *   실제 국가형 프로그램 운영 장소가 확정되면 해당 필드(programTypes)를 교체하십시오.
 */

/** 유통기한 임박 수량이 이 값 이상이면 임박 상태로 본다. */
export const EXPIRING_THRESHOLD = 20;
/** 7일 수요 대비 이 배수 이상 보유하면 과잉 재고로 본다. */
export const SURPLUS_RATIO = 2;

interface SiteSeed {
  id: string;
  name: string;
  district: DistrictId;
  facilityType: FacilityType;
  address: string;
  /** 행정동 경계 중심점 [위도, 경도] (합성 좌표) */
  latitude: number;
  longitude: number;
  inventoryCount: number;
  sevenDayDemand: number;
  expiringCount: number;
  lastUpdatedAt: string;
  focusItem: string;
  /** 데이터 미입력(집계 누락) 거점 */
  dataMissing?: boolean;
  /** 이 장소에서 운영하는 사업 유형. 미지정 시 ['HWASEONG'] */
  programTypes?: ProgramType[];
}

const SITE_SEEDS: SiteSeed[] = [
  // ══════════════════════════════════════════════════════════
  // 만세구 — 11개소 (행정복지센터 9 + 복지관 2)
  // ══════════════════════════════════════════════════════════

  {
    id: 'site-manse-01',
    name: '향남읍 행정복지센터',
    district: 'manse',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 향남읍 행정7로 1',
    latitude: 37.114309,
    longitude: 126.927036,
    inventoryCount: 160,
    sevenDayDemand: 90,
    expiringCount: 8,
    lastUpdatedAt: '2026-08-07T09:20:00',
    focusItem: '즉석밥 세트',
  },
  {
    id: 'site-manse-02',
    name: '남양읍 행정복지센터',
    district: 'manse',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 남양읍 남양로 1',
    latitude: 37.208244,
    longitude: 126.821504,
    inventoryCount: 40,
    sevenDayDemand: 75,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-07T08:40:00',
    focusItem: '즉석밥 세트',
  },
  {
    id: 'site-manse-03',
    name: '우정읍 행정복지센터',
    district: 'manse',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 우정읍 우정로 1',
    latitude: 37.080107,
    longitude: 126.789170,
    inventoryCount: 62,
    sevenDayDemand: 48,
    expiringCount: 26,
    lastUpdatedAt: '2026-08-06T17:10:00',
    focusItem: '쌀 10kg',
    // TODO(synthetic-dual-operation): 실제 자료 없이 데모용으로 지정한 동시 운영
    programTypes: ['HWASEONG', 'NATIONAL'],
  },
  {
    id: 'site-manse-04',
    name: '팔탄면 행정복지센터',
    district: 'manse',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 팔탄면 팔탄로 1',
    latitude: 37.172000,
    longitude: 126.981000,
    inventoryCount: 35,
    sevenDayDemand: 55,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-07T09:00:00',
    focusItem: '즉석밥 세트',
  },
  {
    id: 'site-manse-05',
    name: '마도면 행정복지센터',
    district: 'manse',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 마도면 마도로 1',
    latitude: 37.201000,
    longitude: 126.764000,
    inventoryCount: 100,
    sevenDayDemand: 60,
    expiringCount: 5,
    lastUpdatedAt: '2026-08-07T08:55:00',
    focusItem: '라면 1박스',
  },
  {
    id: 'site-manse-06',
    name: '송산면 행정복지센터',
    district: 'manse',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 송산면 송산로 1',
    latitude: 37.225000,
    longitude: 126.757000,
    inventoryCount: 85,
    sevenDayDemand: 50,
    expiringCount: 3,
    lastUpdatedAt: '2026-08-07T08:30:00',
    focusItem: '라면 1박스',
  },
  {
    id: 'site-manse-07',
    name: '서신면 행정복지센터',
    district: 'manse',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 서신면 서신로 1',
    latitude: 37.181000,
    longitude: 126.673000,
    inventoryCount: 200,
    sevenDayDemand: 80,
    expiringCount: 5,
    lastUpdatedAt: '2026-08-06T16:00:00',
    focusItem: '쌀 10kg',
  },
  {
    id: 'site-manse-08',
    name: '비봉면 행정복지센터',
    district: 'manse',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 비봉면 비봉로 1',
    latitude: 37.266000,
    longitude: 126.874000,
    inventoryCount: 70,
    sevenDayDemand: 45,
    expiringCount: 10,
    lastUpdatedAt: '2026-08-07T09:10:00',
    focusItem: '생필품 꾸러미',
  },
  {
    id: 'site-manse-09',
    name: '장안면 행정복지센터',
    district: 'manse',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 장안면 장안로 1',
    latitude: 37.091000,
    longitude: 126.871000,
    inventoryCount: 25,
    sevenDayDemand: 45,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-07T09:05:00',
    focusItem: '라면 1박스',
  },
  {
    id: 'site-manse-10',
    name: '만세구 종합사회복지관',
    district: 'manse',
    facilityType: '복지관',
    address: '경기도 화성특례시 만세구 종합복지로 1',
    latitude: 37.229975,
    longitude: 126.718832,
    inventoryCount: 0,
    sevenDayDemand: 40,
    expiringCount: 0,
    lastUpdatedAt: '2026-07-24T14:05:00',
    focusItem: '생필품 꾸러미',
    dataMissing: true,
  },
  {
    id: 'site-manse-11',
    name: '향남 지역사회복지관',
    district: 'manse',
    facilityType: '복지관',
    address: '경기도 화성특례시 향남읍 복지로 10',
    latitude: 37.108000,
    longitude: 126.934000,
    inventoryCount: 75,
    sevenDayDemand: 50,
    expiringCount: 22,
    lastUpdatedAt: '2026-08-06T18:20:00',
    focusItem: '쌀 10kg',
  },

  // ══════════════════════════════════════════════════════════
  // 효행구 — 8개소 (행정복지센터 4 + 복지관 3 + 푸드뱅크 1)
  // ══════════════════════════════════════════════════════════

  {
    id: 'site-hyohaeng-01',
    name: '봉담읍 행정복지센터',
    district: 'hyohaeng',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 봉담읍 봉담로 1',
    latitude: 37.204209,
    longitude: 126.939102,
    inventoryCount: 110,
    sevenDayDemand: 60,
    expiringCount: 5,
    lastUpdatedAt: '2026-08-07T09:05:00',
    focusItem: '라면 1박스',
  },
  {
    id: 'site-hyohaeng-02',
    name: '정남면 행정복지센터',
    district: 'hyohaeng',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 정남면 정남로 1',
    latitude: 37.161590,
    longitude: 126.986236,
    inventoryCount: 28,
    sevenDayDemand: 52,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-06T16:30:00',
    focusItem: '라면 1박스',
    // TODO(synthetic-dual-operation): 실제 자료 없이 데모용으로 지정한 동시 운영
    programTypes: ['HWASEONG', 'NATIONAL'],
  },
  {
    id: 'site-hyohaeng-03',
    name: '매송면 행정복지센터',
    district: 'hyohaeng',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 매송면 매송로 1',
    latitude: 37.237000,
    longitude: 126.964000,
    inventoryCount: 95,
    sevenDayDemand: 55,
    expiringCount: 7,
    lastUpdatedAt: '2026-08-07T09:15:00',
    focusItem: '위생용품 세트',
  },
  {
    id: 'site-hyohaeng-04',
    name: '봉담2동 행정복지센터',
    district: 'hyohaeng',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 봉담읍 봉담2로 1',
    latitude: 37.199000,
    longitude: 126.944000,
    inventoryCount: 30,
    sevenDayDemand: 58,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-07T08:45:00',
    focusItem: '쌀 10kg',
  },
  {
    id: 'site-hyohaeng-05',
    name: '효행구 노인복지관',
    district: 'hyohaeng',
    facilityType: '복지관',
    address: '경기도 화성특례시 봉담읍 복지로 20',
    latitude: 37.263268,
    longitude: 126.907226,
    inventoryCount: 96,
    sevenDayDemand: 55,
    expiringCount: 25,
    lastUpdatedAt: '2026-08-07T08:55:00',
    focusItem: '위생용품 세트',
  },
  {
    id: 'site-hyohaeng-06',
    name: '효행구 장애인복지관',
    district: 'hyohaeng',
    facilityType: '복지관',
    address: '경기도 화성특례시 봉담읍 복지로 30',
    latitude: 37.252000,
    longitude: 126.921000,
    inventoryCount: 180,
    sevenDayDemand: 55,
    expiringCount: 8,
    lastUpdatedAt: '2026-08-07T09:00:00',
    focusItem: '위생용품 세트',
  },
  {
    id: 'site-hyohaeng-07',
    name: '효행구 여성가족복지관',
    district: 'hyohaeng',
    facilityType: '복지관',
    address: '경기도 화성특례시 봉담읍 복지로 40',
    latitude: 37.245000,
    longitude: 126.930000,
    inventoryCount: 85,
    sevenDayDemand: 50,
    expiringCount: 10,
    lastUpdatedAt: '2026-08-07T09:20:00',
    focusItem: '라면 1박스',
  },
  {
    id: 'site-hyohaeng-08',
    name: '효행 지역사회 푸드뱅크',
    district: 'hyohaeng',
    facilityType: '푸드뱅크',
    address: '경기도 화성특례시 봉담읍 나눔로 1',
    latitude: 37.192000,
    longitude: 126.967000,
    inventoryCount: 0,
    sevenDayDemand: 35,
    expiringCount: 0,
    lastUpdatedAt: '2026-07-28T10:00:00',
    focusItem: '생필품 꾸러미',
    dataMissing: true,
    programTypes: ['NATIONAL'],
  },

  // ══════════════════════════════════════════════════════════
  // 병점구 — 9개소 (행정복지센터 8 + 복지관 1)
  // ══════════════════════════════════════════════════════════

  {
    id: 'site-byeongjeom-01',
    name: '병점1동 행정복지센터',
    district: 'byeongjeom',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 병점구 병점1로 1',
    latitude: 37.203376,
    longitude: 127.035435,
    inventoryCount: 34,
    sevenDayDemand: 46,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-07T09:15:00',
    focusItem: '생리대 세트',
  },
  {
    id: 'site-byeongjeom-02',
    name: '병점2동 행정복지센터',
    district: 'byeongjeom',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 병점구 병점2로 1',
    latitude: 37.212000,
    longitude: 127.034000,
    inventoryCount: 90,
    sevenDayDemand: 55,
    expiringCount: 6,
    lastUpdatedAt: '2026-08-07T09:00:00',
    focusItem: '생리대 세트',
  },
  {
    id: 'site-byeongjeom-03',
    name: '진안동 행정복지센터',
    district: 'byeongjeom',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 병점구 진안로 1',
    latitude: 37.221750,
    longitude: 127.037095,
    inventoryCount: 130,
    sevenDayDemand: 58,
    expiringCount: 6,
    lastUpdatedAt: '2026-08-07T08:35:00',
    focusItem: '생리대 세트',
    // TODO(synthetic-dual-operation): 실제 자료 없이 데모용으로 지정한 동시 운영
    programTypes: ['HWASEONG', 'NATIONAL'],
  },
  {
    id: 'site-byeongjeom-04',
    name: '반월동 행정복지센터',
    district: 'byeongjeom',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 병점구 반월로 1',
    latitude: 37.226954,
    longitude: 127.060336,
    inventoryCount: 70,
    sevenDayDemand: 44,
    expiringCount: 24,
    lastUpdatedAt: '2026-08-06T18:00:00',
    focusItem: '통조림 세트',
  },
  {
    id: 'site-byeongjeom-05',
    name: '기배동 행정복지센터',
    district: 'byeongjeom',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 병점구 기배로 1',
    latitude: 37.214000,
    longitude: 127.049000,
    inventoryCount: 45,
    sevenDayDemand: 65,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-07T08:50:00',
    focusItem: '위생용품 세트',
  },
  {
    id: 'site-byeongjeom-06',
    name: '화산동 행정복지센터',
    district: 'byeongjeom',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 병점구 화산로 1',
    latitude: 37.206000,
    longitude: 127.028000,
    inventoryCount: 75,
    sevenDayDemand: 50,
    expiringCount: 4,
    lastUpdatedAt: '2026-08-07T09:10:00',
    focusItem: '생리대 세트',
  },
  {
    id: 'site-byeongjeom-07',
    name: '안녕동 행정복지센터',
    district: 'byeongjeom',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 병점구 안녕로 1',
    latitude: 37.218000,
    longitude: 127.031000,
    inventoryCount: 25,
    sevenDayDemand: 42,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-07T08:40:00',
    focusItem: '생리대 세트',
  },
  {
    id: 'site-byeongjeom-08',
    name: '양감면 행정복지센터',
    district: 'byeongjeom',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 양감면 양감로 1',
    latitude: 37.113000,
    longitude: 127.032000,
    inventoryCount: 80,
    sevenDayDemand: 48,
    expiringCount: 8,
    lastUpdatedAt: '2026-08-07T09:05:00',
    focusItem: '통조림 세트',
  },
  {
    id: 'site-byeongjeom-09',
    name: '병점구 종합사회복지관',
    district: 'byeongjeom',
    facilityType: '복지관',
    address: '경기도 화성특례시 병점구 복지로 1',
    latitude: 37.210000,
    longitude: 127.043000,
    inventoryCount: 0,
    sevenDayDemand: 45,
    expiringCount: 0,
    lastUpdatedAt: '2026-07-30T11:00:00',
    focusItem: '통조림 세트',
    dataMissing: true,
  },

  // ══════════════════════════════════════════════════════════
  // 동탄구 — 11개소 (행정복지센터 8 + 복지관 3)
  // ══════════════════════════════════════════════════════════

  {
    id: 'site-dongtan-01',
    name: '동탄1동 행정복지센터',
    district: 'dongtan',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 동탄구 동탄1로 1',
    latitude: 37.210275,
    longitude: 127.074142,
    inventoryCount: 88,
    sevenDayDemand: 40,
    expiringCount: 22,
    lastUpdatedAt: '2026-08-07T09:30:00',
    focusItem: '분유 800g',
  },
  {
    id: 'site-dongtan-02',
    name: '동탄2동 행정복지센터',
    district: 'dongtan',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 동탄구 동탄2로 1',
    latitude: 37.220000,
    longitude: 127.085000,
    inventoryCount: 55,
    sevenDayDemand: 70,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-07T09:20:00',
    focusItem: '분유 800g',
  },
  {
    id: 'site-dongtan-03',
    name: '동탄3동 행정복지센터',
    district: 'dongtan',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 동탄구 동탄3로 1',
    latitude: 37.214000,
    longitude: 127.095000,
    inventoryCount: 95,
    sevenDayDemand: 60,
    expiringCount: 11,
    lastUpdatedAt: '2026-08-07T09:05:00',
    focusItem: '생필품 꾸러미',
  },
  {
    id: 'site-dongtan-04',
    name: '동탄4동 행정복지센터',
    district: 'dongtan',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 동탄구 동탄4로 1',
    latitude: 37.195638,
    longitude: 127.111932,
    inventoryCount: 150,
    sevenDayDemand: 62,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-07T09:10:00',
    focusItem: '분유 800g',
    // TODO(synthetic-dual-operation): 실제 자료 없이 데모용으로 지정한 동시 운영
    programTypes: ['HWASEONG', 'NATIONAL'],
  },
  {
    id: 'site-dongtan-05',
    name: '동탄5동 행정복지센터',
    district: 'dongtan',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 동탄구 동탄5로 1',
    latitude: 37.209326,
    longitude: 127.123617,
    inventoryCount: 42,
    sevenDayDemand: 62,
    expiringCount: 0,
    lastUpdatedAt: '2026-08-07T08:50:00',
    focusItem: '분유 800g',
  },
  {
    id: 'site-dongtan-06',
    name: '동탄6동 행정복지센터',
    district: 'dongtan',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 동탄구 동탄6로 1',
    latitude: 37.202000,
    longitude: 127.100000,
    inventoryCount: 105,
    sevenDayDemand: 58,
    expiringCount: 9,
    lastUpdatedAt: '2026-08-07T09:15:00',
    focusItem: '분유 800g',
  },
  {
    id: 'site-dongtan-07',
    name: '동탄7동 행정복지센터',
    district: 'dongtan',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 동탄구 동탄7로 1',
    latitude: 37.186000,
    longitude: 127.109000,
    inventoryCount: 85,
    sevenDayDemand: 52,
    expiringCount: 7,
    lastUpdatedAt: '2026-08-07T09:00:00',
    focusItem: '즉석밥 세트',
  },
  {
    id: 'site-dongtan-08',
    name: '동탄8동 행정복지센터',
    district: 'dongtan',
    facilityType: '행정복지센터',
    address: '경기도 화성특례시 동탄구 동탄8로 1',
    latitude: 37.154975,
    longitude: 127.111835,
    inventoryCount: 50,
    sevenDayDemand: 30,
    expiringCount: 25,
    lastUpdatedAt: '2026-08-06T17:45:00',
    focusItem: '분유 800g',
  },
  {
    id: 'site-dongtan-09',
    name: '동탄구 종합사회복지관',
    district: 'dongtan',
    facilityType: '복지관',
    address: '경기도 화성특례시 동탄구 복지로 1',
    latitude: 37.205000,
    longitude: 127.090000,
    inventoryCount: 90,
    sevenDayDemand: 55,
    expiringCount: 5,
    lastUpdatedAt: '2026-08-07T09:25:00',
    focusItem: '통조림 세트',
  },
  {
    id: 'site-dongtan-10',
    name: '동탄구 노인복지관',
    district: 'dongtan',
    facilityType: '복지관',
    address: '경기도 화성특례시 동탄구 복지로 10',
    latitude: 37.197000,
    longitude: 127.102000,
    inventoryCount: 160,
    sevenDayDemand: 65,
    expiringCount: 3,
    lastUpdatedAt: '2026-08-07T09:20:00',
    focusItem: '위생용품 세트',
  },
  {
    id: 'site-dongtan-11',
    name: '동탄구 장애인복지관',
    district: 'dongtan',
    facilityType: '복지관',
    address: '경기도 화성특례시 동탄구 복지로 20',
    latitude: 37.213000,
    longitude: 127.117000,
    inventoryCount: 0,
    sevenDayDemand: 38,
    expiringCount: 0,
    lastUpdatedAt: '2026-07-31T14:00:00',
    focusItem: '생필품 꾸러미',
    dataMissing: true,
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
    latitude: seed.latitude,
    longitude: seed.longitude,
    status: resolveStatus(seed, expectedShortage),
    inventoryCount: seed.inventoryCount,
    sevenDayDemand: seed.sevenDayDemand,
    expectedShortage,
    expiringCount: seed.expiringCount,
    lastUpdatedAt: seed.lastUpdatedAt,
    focusItem: seed.focusItem,
    isDemo: true,
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
