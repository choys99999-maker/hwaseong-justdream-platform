/**
 * 화성시 그냥드림 43개 사업 거점 — 사업 프로그램 기준 canonical 디렉토리.
 *
 * "43개 사업 거점"과 "43개의 서로 다른 물리적 위치"는 동일하지 않다.
 * 같은 장소에서 국가형·화성형을 동시에 운영하는 경우 programs 배열로 표현한다.
 *
 * 프로그램 수 기준:
 *   전체 43 = 국가형 5 + 화성형 38 (읍면동 29 + 복지관 9)
 *
 * 읍면동 29 행정구역 출처: src/data/geo/hwaseongDistricts.geo.json (공식 경계 데이터)
 *   만세구 10: 우정읍·향남읍·남양읍·서신면·마도면·송산면·팔탄면·장안면·양감면·새솔동
 *   효행구  5: 봉담읍·비봉면·기배동·매송면·정남면
 *   병점구  5: 병점1동·병점2동·진안동·반월동·화산동
 *   동탄구  9: 동탄1동~동탄9동
 *
 * CONFIRMED = 기관명·주소·좌표·그냥드림 참여 모두 확인됨 (실적 엑셀 + Kakao SDK 검증)
 * PENDING   = 기관명은 공식 행정구역이지만 주소·좌표 미확인
 *
 * 이 파일은 프로그램 구성·거점 명단 정보만 담는다.
 * 재고·수요 등 운영 데이터는 mockSites.ts / operationSummary.ts 에 있다.
 * (운영 데이터가 확보된 거점 = justdream_sites_25.ts 기준 25개소)
 *
 * 추측 주소·좌표 생성 금지.
 * 가짜 기관명·주소·좌표를 넣어 43을 맞추지 않는다.
 */

import type { DistrictId } from '../types';

export type JdProgramType = 'NATIONAL' | 'HWASEONG';
export type VerificationStatus = 'CONFIRMED' | 'PENDING';
export type JdSiteType = 'ADMIN_CENTER' | 'WELFARE_CENTER' | 'FOODBANK' | 'FOODMARKET' | 'OTHER';

export interface JustDreamLocation {
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  programs: JdProgramType[];
  siteType: JdSiteType;
  district?: DistrictId;
  verification: VerificationStatus;
  sourceNote?: string;
}

export const JUSTDREAM_LOCATIONS: JustDreamLocation[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // 화성형 복지관 9개 (전체 CONFIRMED, 좌표 확정)
  // 출처: justdream_sites_25.ts (실적 엑셀 기준, Kakao SDK 1회 조회 후 정적 저장)
  // ══════════════════════════════════════════════════════════════════════════

  // 종합사회복지관 3
  {
    id: 'jd-wc-dongtan-chidongcheon',
    name: '화성시동탄치동천종합사회복지관',
    address: '경기 화성시 동탄구 동탄순환대로24길 101',
    lat: 37.206144,
    lng: 127.122749,
    programs: ['HWASEONG'],
    siteType: 'WELFARE_CENTER',
    district: 'dongtan',
    verification: 'CONFIRMED',
  },
  {
    id: 'jd-wc-dongtan-eoulim',
    name: '화성시동탄어울림종합사회복지관',
    address: '경기 화성시 동탄구 청계동 530',
    lat: 37.199802,
    lng: 127.112284,
    programs: ['HWASEONG'],
    siteType: 'WELFARE_CENTER',
    district: 'dongtan',
    verification: 'CONFIRMED',
    sourceNote: '동탄4동행정복지센터와 동일 복합청사(청계동 530)',
  },
  {
    id: 'jd-wc-seobu-jonghap',
    name: '화성시서부종합사회복지관',
    address: '경기 화성시 만세구 송산면 사강로 145',
    lat: 37.213046,
    lng: 126.73203,
    programs: ['NATIONAL', 'HWASEONG'],
    siteType: 'WELFARE_CENTER',
    district: 'manse',
    verification: 'CONFIRMED',
    sourceNote: '국가형 그냥드림 사업장으로도 지정됨 (국가형+화성형 동시 운영)',
  },

  // 장애인복지관 2
  {
    id: 'jd-wc-ardim',
    name: '화성시아르딤복지관',
    address: '경기 화성시 만세구 향남읍 도이1길 104',
    lat: 37.13657,
    lng: 126.920475,
    programs: ['HWASEONG'],
    siteType: 'WELFARE_CENTER',
    district: 'manse',
    verification: 'CONFIRMED',
  },
  {
    id: 'jd-wc-dongtan-ardim',
    name: '화성시동탄아르딤복지관',
    address: '경기 화성시 동탄구 동탄대로10길 17-12',
    lat: 37.176687,
    lng: 127.107844,
    programs: ['HWASEONG'],
    siteType: 'WELFARE_CENTER',
    district: 'dongtan',
    verification: 'CONFIRMED',
  },

  // 노인복지관 4
  {
    id: 'jd-wc-nambu-noin',
    name: '화성시남부노인복지관',
    address: '경기 화성시 만세구 향남읍 토성로 37-22',
    lat: 37.128853,
    lng: 126.936166,
    programs: ['HWASEONG'],
    siteType: 'WELFARE_CENTER',
    district: 'manse',
    verification: 'CONFIRMED',
  },
  {
    id: 'jd-wc-seobu-noin',
    name: '화성시서부노인복지관',
    address: '경기 화성시 만세구 남양읍 시청로 155',
    lat: 37.198854,
    lng: 126.828627,
    programs: ['HWASEONG'],
    siteType: 'WELFARE_CENTER',
    district: 'manse',
    verification: 'CONFIRMED',
  },
  {
    id: 'jd-wc-dongtan-noin',
    name: '화성시동탄노인복지관',
    address: '경기 화성시 동탄구 동탄대로8길 36',
    lat: 37.170548,
    lng: 127.110457,
    programs: ['HWASEONG'],
    siteType: 'WELFARE_CENTER',
    district: 'dongtan',
    verification: 'CONFIRMED',
    sourceNote: '동탄7동행정복지센터와 동일 건물(동탄호수공원 복합커뮤니티센터)',
  },
  {
    id: 'jd-wc-jeongjohyo-noin',
    name: '화성시정조효노인복지관',
    address: '경기 화성시 병점구 용주로152번길 27',
    lat: 37.21195,
    lng: 127.002727,
    programs: ['HWASEONG'],
    siteType: 'WELFARE_CENTER',
    district: 'byeongjeom',
    verification: 'CONFIRMED',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 화성형 읍면동 행정복지센터 29개
  // 구별 행정동 수: 만세구 10, 효행구 5, 병점구 5, 동탄구 9
  // 출처: src/data/geo/hwaseongDistricts.geo.json (공식 경계 데이터)
  // CONFIRMED: 주소·좌표 확정 (justdream_sites_25.ts 출처, 실적 엑셀 + Kakao SDK)
  // PENDING: 읍면동 명칭은 공식 행정구역이지만 주소·좌표 미확인
  // ══════════════════════════════════════════════════════════════════════════

  // ── 만세구 (10개소) ──────────────────────────────────────────────────────
  {
    id: 'jd-ac-ujeong',
    name: '우정읍행정복지센터',
    address: '경기 화성시 만세구 우정읍 쌍봉로 109-14',
    lat: 37.08982,
    lng: 126.815312,
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'manse',
    verification: 'CONFIRMED',
  },
  {
    id: 'jd-ac-hyangnam',
    name: '향남읍행정복지센터',
    address: '경기 화성시 만세구 향남읍 발안로 89',
    lat: 37.132431,
    lng: 126.920344,
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'manse',
    verification: 'CONFIRMED',
  },
  {
    id: 'jd-ac-namyang-eup',
    name: '남양읍행정복지센터',
    address: '경기 화성시 만세구 남양읍 화성시청역로 36',
    lat: 37.19302,
    lng: 126.821319,
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'manse',
    verification: 'CONFIRMED',
    sourceNote: '카카오 등록명 남양읍임시행정복지센터; 임시청사(화성시청역로 36) 운영 중',
  },
  {
    id: 'jd-ac-seoshin',
    name: '서신면행정복지센터',
    address: '경기 화성시 만세구 서신면 궁평항로 1702',
    lat: 37.166571,
    lng: 126.708733,
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'manse',
    verification: 'CONFIRMED',
  },
  {
    id: 'jd-ac-yangam',
    name: '양감면행정복지센터',
    address: '경기 화성시 만세구 양감면 초록로 7',
    lat: 37.081562,
    lng: 126.945496,
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'manse',
    verification: 'CONFIRMED',
  },
  {
    id: 'jd-ac-mado',
    name: '마도면행정복지센터',
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'manse',
    verification: 'PENDING',
    sourceNote: '화성시 만세구 마도면; 주소·좌표 미확인',
  },
  {
    id: 'jd-ac-songsan',
    name: '송산면행정복지센터',
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'manse',
    verification: 'PENDING',
    sourceNote: '화성시 만세구 송산면; 주소·좌표 미확인',
  },
  {
    id: 'jd-ac-paltan',
    name: '팔탄면행정복지센터',
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'manse',
    verification: 'PENDING',
    sourceNote: '화성시 만세구 팔탄면; 주소·좌표 미확인',
  },
  {
    id: 'jd-ac-jangan',
    name: '장안면행정복지센터',
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'manse',
    verification: 'PENDING',
    sourceNote: '화성시 만세구 장안면; 주소·좌표 미확인',
  },
  {
    id: 'jd-ac-saesol',
    name: '새솔동행정복지센터',
    address: '경기 화성시 만세구 수노을중앙로 178',
    lat: 37.281276,
    lng: 126.818691,
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'manse',
    verification: 'CONFIRMED',
  },

  // ── 효행구 (5개소) ──────────────────────────────────────────────────────
  {
    id: 'jd-ac-bongdam',
    name: '봉담읍행정복지센터',
    address: '경기 화성시 효행구 봉담읍 샘마을1길 7',
    lat: 37.220067,
    lng: 126.949542,
    programs: ['NATIONAL', 'HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'hyohaeng',
    verification: 'CONFIRMED',
    sourceNote: '국가형 그냥드림 사업장으로도 지정됨 (국가형+화성형 동시 운영)',
  },
  {
    id: 'jd-ac-bibong',
    name: '비봉면행정복지센터',
    address: '경기 화성시 효행구 비봉면 비봉로71번길 1',
    lat: 37.235174,
    lng: 126.873401,
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'hyohaeng',
    verification: 'CONFIRMED',
  },
  {
    id: 'jd-ac-gibae',
    name: '기배동행정복지센터',
    address: '경기 화성시 효행구 기안남로 62',
    lat: 37.224392,
    lng: 126.984676,
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'hyohaeng',
    verification: 'CONFIRMED',
  },
  {
    id: 'jd-ac-maesong',
    name: '매송면행정복지센터',
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'hyohaeng',
    verification: 'PENDING',
    sourceNote: '화성시 효행구 매송면; 주소·좌표 미확인',
  },
  {
    id: 'jd-ac-jeongnam',
    name: '정남면행정복지센터',
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'hyohaeng',
    verification: 'PENDING',
    sourceNote: '화성시 효행구 정남면; 주소·좌표 미확인',
  },

  // ── 병점구 (5개소) ──────────────────────────────────────────────────────
  {
    id: 'jd-ac-byeongjeom1',
    name: '병점1동행정복지센터',
    address: '경기 화성시 병점구 경기대로1010번길 11',
    lat: 37.20687,
    lng: 127.037274,
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'byeongjeom',
    verification: 'CONFIRMED',
  },
  {
    id: 'jd-ac-byeongjeom2',
    name: '병점2동행정복지센터',
    address: '경기 화성시 병점구 병점3로 99',
    lat: 37.211478,
    lng: 127.043022,
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'byeongjeom',
    verification: 'CONFIRMED',
  },
  {
    id: 'jd-ac-jinan',
    name: '진안동행정복지센터',
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'byeongjeom',
    verification: 'PENDING',
    sourceNote: '화성시 병점구 진안동; 주소·좌표 미확인',
  },
  {
    id: 'jd-ac-banwol',
    name: '반월동행정복지센터',
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'byeongjeom',
    verification: 'PENDING',
    sourceNote: '화성시 병점구 반월동; 주소·좌표 미확인',
  },
  {
    id: 'jd-ac-hwasan',
    name: '화산동행정복지센터',
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'byeongjeom',
    verification: 'PENDING',
    sourceNote: '화성시 병점구 화산동; 주소·좌표 미확인',
  },

  // ── 동탄구 (9개소) ──────────────────────────────────────────────────────
  {
    id: 'jd-ac-dongtan1',
    name: '동탄1동행정복지센터',
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'dongtan',
    verification: 'PENDING',
    sourceNote: '화성시 동탄구 동탄1동; 주소·좌표 미확인',
  },
  {
    id: 'jd-ac-dongtan2',
    name: '동탄2동행정복지센터',
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'dongtan',
    verification: 'PENDING',
    sourceNote: '화성시 동탄구 동탄2동; 주소·좌표 미확인',
  },
  {
    id: 'jd-ac-dongtan3',
    name: '동탄3동행정복지센터',
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'dongtan',
    verification: 'PENDING',
    sourceNote: '화성시 동탄구 동탄3동; 주소·좌표 미확인',
  },
  {
    id: 'jd-ac-dongtan4',
    name: '동탄4동행정복지센터',
    address: '경기 화성시 동탄구 청계동 530',
    lat: 37.199665,
    lng: 127.112415,
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'dongtan',
    verification: 'CONFIRMED',
    sourceNote: '동탄어울림종합사회복지관과 동일 복합청사(청계동 530); 카카오 좌표가 복지관과 미세 차이 있음',
  },
  {
    id: 'jd-ac-dongtan5',
    name: '동탄5동행정복지센터',
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'dongtan',
    verification: 'PENDING',
    sourceNote: '화성시 동탄구 동탄5동; 주소·좌표 미확인',
  },
  {
    id: 'jd-ac-dongtan6',
    name: '동탄6동행정복지센터',
    address: '경기 화성시 동탄구 동탄감배산로 54',
    lat: 37.191509,
    lng: 127.090226,
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'dongtan',
    verification: 'CONFIRMED',
  },
  {
    id: 'jd-ac-dongtan7',
    name: '동탄7동행정복지센터',
    address: '경기 화성시 동탄구 동탄대로8길 36',
    lat: 37.170548,
    lng: 127.110457,
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'dongtan',
    verification: 'CONFIRMED',
    sourceNote: '동탄노인복지관과 동일 건물(동탄호수공원 복합커뮤니티센터)',
  },
  {
    id: 'jd-ac-dongtan8',
    name: '동탄8동행정복지센터',
    address: '경기 화성시 동탄구 동탄대로 87',
    lat: 37.162299,
    lng: 127.105276,
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'dongtan',
    verification: 'CONFIRMED',
  },
  {
    id: 'jd-ac-dongtan9',
    name: '동탄9동행정복지센터',
    address: '경기 화성시 동탄구 동탄신리천로9길 76',
    lat: 37.18065,
    lng: 127.138383,
    programs: ['HWASEONG'],
    siteType: 'ADMIN_CENTER',
    district: 'dongtan',
    verification: 'CONFIRMED',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 국가형 전용 거점 3개 (PENDING — 주소·좌표 미확인)
  // 화성시 소재 국가형 그냥드림 사업장으로 파악됨.
  // 추측 주소·좌표 생성 금지 원칙에 따라 확인 전까지 PENDING 유지.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'jd-fm-haengbok',
    name: '행복나눔푸드마켓',
    programs: ['NATIONAL'],
    siteType: 'FOODMARKET',
    verification: 'PENDING',
    sourceNote: '국가형 그냥드림 사업장; 화성시 소재 확인, 주소·좌표 미확인',
  },
  {
    id: 'jd-fm-naraaeul',
    name: '나래울푸드마켓',
    programs: ['NATIONAL'],
    siteType: 'FOODMARKET',
    verification: 'PENDING',
    sourceNote: '국가형 그냥드림 사업장; 화성시 소재 확인, 주소·좌표 미확인',
  },
  {
    id: 'jd-fb-eunhye',
    name: '화성은혜푸드뱅크',
    programs: ['NATIONAL'],
    siteType: 'FOODBANK',
    verification: 'PENDING',
    sourceNote: '국가형 그냥드림 사업장; 화성시 소재 확인, 주소·좌표 미확인',
  },
];

// ── 파생 집계 (하드코딩 없음 — 배열에서 계산) ────────────────────────────────
const _national = JUSTDREAM_LOCATIONS.filter((l) => l.programs.includes('NATIONAL')).length;
const _hwaseong = JUSTDREAM_LOCATIONS.filter((l) => l.programs.includes('HWASEONG')).length;
const _hwaseongAdmin = JUSTDREAM_LOCATIONS.filter(
  (l) => l.programs.includes('HWASEONG') && l.siteType === 'ADMIN_CENTER',
).length;
const _hwaseongWelfare = JUSTDREAM_LOCATIONS.filter(
  (l) => l.programs.includes('HWASEONG') && l.siteType === 'WELFARE_CENTER',
).length;

/** 사업 거점 수 집계. 거점 명단 항목 수와 프로그램 수를 분리해서 관리한다. */
export const JD_COUNTS = {
  /** 전체 사업 프로그램 수. 43 = 국가형 5 + 화성형 38 */
  totalPrograms: _national + _hwaseong,
  national: _national,
  hwaseong: _hwaseong,
  hwaseongAdminCenter: _hwaseongAdmin,
  hwaseongWelfareCenter: _hwaseongWelfare,
  /**
   * 거점 명단 항목 수. JUSTDREAM_LOCATIONS 배열 길이.
   * 동일 물리 위치에서 국가형+화성형을 동시 운영하는 경우 1개 항목으로 처리한다.
   * 단, "실제 물리 위치 수"를 확정 사실로 단언하지 않는다 —
   * 동시 운영 2곳은 사업 담당자 확인 정보이며 독립 검증 자료가 없다.
   */
  locationEntries: JUSTDREAM_LOCATIONS.length,
  /** 기관명·주소·좌표·그냥드림 참여 모두 확인된 거점 수 (실적 엑셀 + Kakao SDK) */
  confirmedLocations: JUSTDREAM_LOCATIONS.filter((l) => l.verification === 'CONFIRMED').length,
  /** 기관명은 확인됐지만 주소·좌표 미확인 거점 수 */
  pendingLocations: JUSTDREAM_LOCATIONS.filter((l) => l.verification === 'PENDING').length,
  /** 국가형+화성형 동시 운영으로 처리한 항목 수 (사업 담당자 확인 정보) */
  dualProgramLocations: JUSTDREAM_LOCATIONS.filter((l) => l.programs.length > 1).length,
};
