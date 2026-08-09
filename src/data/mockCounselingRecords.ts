import type { CounselingRecord } from '../types';

/**
 * 화성시 2차 연계 대상자 실적 서식 기반 합성 데이터 (25건)
 * 기관명·방문구분·대상자(마스킹)·생년월일·주소·상담일자·2차연계처·연계상담·연계상태 포함
 */
export const mockCounselingRecords: CounselingRecord[] = [
  {
    id: 'cr-001', seq: 1,
    orgName: '남양읍 행정복지센터', regionId: 'manse',
    visitType: '최초방문', clientName: '홍○동',
    birthDate: '1958-03-12', address: '화성시 남양읍 ○○로 12',
    counselingDate: '2026-08-09', secondReferralDong: '남양읍',
    linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '통합돌봄',
    history: [
      {
        visitNo: 1, visitDate: '2026-08-09', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '통합돌봄',
        secondReferralDong: '남양읍', counselingNote: '독거 노인, 통합돌봄 서비스 즉시 연계 완료',
      },
    ],
  },
  {
    id: 'cr-002', seq: 2,
    orgName: '남양읍 행정복지센터', regionId: 'manse',
    visitType: '재방문', clientName: '김○순',
    birthDate: '1945-07-22', address: '화성시 남양읍 ○○길 34',
    counselingDate: '2026-08-09', secondReferralDong: '남양읍',
    linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '반찬지원',
    history: [
      {
        visitNo: 1, visitDate: '2026-07-10', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '남양읍', counselingNote: '영양 상태 불량, 지원 방안 검토 시작',
      },
      {
        visitNo: 2, visitDate: '2026-08-09', visitType: '재방문',
        linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '반찬지원',
        secondReferralDong: '남양읍', counselingNote: '주 3회 반찬 배달 연계 완료',
      },
    ],
  },
  {
    id: 'cr-003', seq: 3,
    orgName: '향남읍 행정복지센터', regionId: 'hyohaeng',
    visitType: '최초방문', clientName: '이○호',
    birthDate: '1972-11-05', address: '화성시 향남읍 ○○로 45',
    counselingDate: '2026-08-08', secondReferralDong: '향남읍',
    linkageConducted: 'O', linkageStatus: '검토중',
    history: [
      {
        visitNo: 1, visitDate: '2026-08-08', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '향남읍', counselingNote: '장기 실직 가구, 긴급복지 지원 검토 중',
      },
    ],
  },
  {
    id: 'cr-004', seq: 4,
    orgName: '향남읍 행정복지센터', regionId: 'hyohaeng',
    visitType: '재방문', clientName: '박○례',
    birthDate: '1965-05-18', address: '화성시 향남읍 ○○대로 67',
    counselingDate: '2026-08-08', secondReferralDong: '향남읍',
    linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '긴급복지지원',
    history: [
      {
        visitNo: 1, visitDate: '2026-06-20', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '향남읍', counselingNote: '갑작스러운 가정위기 발생',
      },
      {
        visitNo: 2, visitDate: '2026-07-18', visitType: '재방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '향남읍', counselingNote: '서류 접수 완료, 결정 대기',
      },
      {
        visitNo: 3, visitDate: '2026-08-08', visitType: '재방문',
        linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '긴급복지지원',
        secondReferralDong: '향남읍', counselingNote: '긴급복지지원 승인 완료, 생계비 지급',
      },
    ],
  },
  {
    id: 'cr-005', seq: 5,
    orgName: '봉담읍 행정복지센터', regionId: 'hyohaeng',
    visitType: '최초방문', clientName: '최○자',
    birthDate: '1980-09-30', address: '화성시 봉담읍 ○○로 89',
    counselingDate: '2026-08-07', secondReferralDong: '봉담읍',
    linkageConducted: 'X', linkageStatus: '검토중',
    note: '추가 서류 보완 후 재방문 예정',
    history: [
      {
        visitNo: 1, visitDate: '2026-08-07', visitType: '최초방문',
        linkageConducted: 'X', linkageStatus: '검토중',
        secondReferralDong: '봉담읍', counselingNote: '서류 미비, 다음 방문 시 상담 실시 예정',
      },
    ],
  },
  {
    id: 'cr-006', seq: 6,
    orgName: '봉담읍 행정복지센터', regionId: 'hyohaeng',
    visitType: '재방문', clientName: '정○철',
    birthDate: '1955-02-14', address: '화성시 봉담읍 ○○길 101',
    counselingDate: '2026-08-07', secondReferralDong: '봉담읍',
    linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '노인돌봄기본서비스',
    history: [
      {
        visitNo: 1, visitDate: '2026-07-25', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '봉담읍', counselingNote: '일상생활 수행 어려움, 돌봄 욕구 확인',
      },
      {
        visitNo: 2, visitDate: '2026-08-07', visitType: '재방문',
        linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '노인돌봄기본서비스',
        secondReferralDong: '봉담읍', counselingNote: '노인돌봄 기본서비스 주 2회 연계 완료',
      },
    ],
  },
  {
    id: 'cr-007', seq: 7,
    orgName: '팔탄면 행정복지센터', regionId: 'manse',
    visitType: '최초방문', clientName: '강○민',
    birthDate: '1990-06-22', address: '화성시 팔탄면 ○○로 23',
    counselingDate: '2026-08-06', secondReferralDong: '팔탄면',
    linkageConducted: 'X', linkageStatus: '연계불요',
    note: '본인 의사로 연계 불필요 확인',
    history: [
      {
        visitNo: 1, visitDate: '2026-08-06', visitType: '최초방문',
        linkageConducted: 'X', linkageStatus: '연계불요',
        secondReferralDong: '팔탄면', counselingNote: '자립 의지 강함, 연계 불필요 의사 표현',
      },
    ],
  },
  {
    id: 'cr-008', seq: 8,
    orgName: '팔탄면 행정복지센터', regionId: 'manse',
    visitType: '재방문', clientName: '조○희',
    birthDate: '1962-08-11', address: '화성시 팔탄면 ○○로 55',
    counselingDate: '2026-08-06', secondReferralDong: '팔탄면',
    linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '주거급여',
    history: [
      {
        visitNo: 1, visitDate: '2026-07-20', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '팔탄면', counselingNote: '노후 주택 거주, 주거지원 신청 안내',
      },
      {
        visitNo: 2, visitDate: '2026-08-06', visitType: '재방문',
        linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '주거급여',
        secondReferralDong: '팔탄면', counselingNote: '주거급여 신청 완료 및 수리비 지원 확정',
      },
    ],
  },
  {
    id: 'cr-009', seq: 9,
    orgName: '병점1동 행정복지센터', regionId: 'byeongjeom',
    visitType: '최초방문', clientName: '윤○수',
    birthDate: '1975-04-07', address: '화성시 병점1동 ○○로 188',
    counselingDate: '2026-08-05', secondReferralDong: '병점1동',
    linkageConducted: 'O', linkageStatus: '검토중',
    history: [
      {
        visitNo: 1, visitDate: '2026-08-05', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '병점1동', counselingNote: '4인 가족 소득 감소, 차상위 해당 여부 검토',
      },
    ],
  },
  {
    id: 'cr-010', seq: 10,
    orgName: '병점1동 행정복지센터', regionId: 'byeongjeom',
    visitType: '재방문', clientName: '장○미',
    birthDate: '1948-12-25', address: '화성시 병점2동 ○○길 9',
    counselingDate: '2026-08-05', secondReferralDong: '병점1동',
    linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '반찬지원',
    history: [
      {
        visitNo: 1, visitDate: '2026-06-12', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '병점1동', counselingNote: '고령 독거, 영양 지원 욕구 확인',
      },
      {
        visitNo: 2, visitDate: '2026-07-08', visitType: '재방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '병점1동', counselingNote: '건강 상태 악화, 우선 지원 필요',
      },
      {
        visitNo: 3, visitDate: '2026-08-05', visitType: '재방문',
        linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '반찬지원',
        secondReferralDong: '병점1동', counselingNote: '지역 반찬 나눔 사업 연계 확정, 주 2회 배달',
      },
    ],
  },
  {
    id: 'cr-011', seq: 11,
    orgName: '화산동 행정복지센터', regionId: 'byeongjeom',
    visitType: '최초방문', clientName: '임○수',
    birthDate: '1983-07-03', address: '화성시 화산동 ○○로 67',
    counselingDate: '2026-08-04', secondReferralDong: '화산동',
    linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '의료급여',
    history: [
      {
        visitNo: 1, visitDate: '2026-08-04', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '의료급여',
        secondReferralDong: '화산동', counselingNote: '만성질환 치료비 부담, 의료급여 2종 연계 완료',
      },
    ],
  },
  {
    id: 'cr-012', seq: 12,
    orgName: '화산동 행정복지센터', regionId: 'byeongjeom',
    visitType: '재방문', clientName: '한○진',
    birthDate: '1970-01-28', address: '화성시 화산동 ○○대로 234',
    counselingDate: '2026-08-04', secondReferralDong: '화산동',
    linkageConducted: 'X', linkageStatus: '연계불요',
    note: '소득 기준 초과로 연계 서비스 해당 없음',
    history: [
      {
        visitNo: 1, visitDate: '2026-07-15', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '화산동', counselingNote: '지원 가능 서비스 안내 및 소득 조사 진행',
      },
      {
        visitNo: 2, visitDate: '2026-08-04', visitType: '재방문',
        linkageConducted: 'X', linkageStatus: '연계불요',
        secondReferralDong: '화산동', counselingNote: '소득 기준 초과 확인, 연계 서비스 없음',
      },
    ],
  },
  {
    id: 'cr-013', seq: 13,
    orgName: '동탄4동 행정복지센터', regionId: 'dongtan',
    visitType: '최초방문', clientName: '오○숙',
    birthDate: '1960-10-15', address: '화성시 동탄4동 ○○로 456',
    counselingDate: '2026-08-03', secondReferralDong: '동탄4동',
    linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '생계급여',
    history: [
      {
        visitNo: 1, visitDate: '2026-08-03', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '생계급여',
        secondReferralDong: '동탄4동', counselingNote: '기초생활수급 신청 완료, 생계급여 지급 예정',
      },
    ],
  },
  {
    id: 'cr-014', seq: 14,
    orgName: '동탄4동 행정복지센터', regionId: 'dongtan',
    visitType: '재방문', clientName: '서○영',
    birthDate: '1985-03-20', address: '화성시 동탄4동 ○○길 78',
    counselingDate: '2026-08-03', secondReferralDong: '동탄4동',
    linkageConducted: 'O', linkageStatus: '검토중',
    history: [
      {
        visitNo: 1, visitDate: '2026-07-22', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '동탄4동', counselingNote: '한부모 가정, 아동 양육 지원 검토',
      },
      {
        visitNo: 2, visitDate: '2026-08-03', visitType: '재방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '동탄4동', counselingNote: '추가 서류 제출, 한부모가족 지원 심사 중',
      },
    ],
  },
  {
    id: 'cr-015', seq: 15,
    orgName: '동탄6동 행정복지센터', regionId: 'dongtan',
    visitType: '최초방문', clientName: '신○래',
    birthDate: '1952-06-08', address: '화성시 동탄6동 ○○로 123',
    counselingDate: '2026-08-02', secondReferralDong: '동탄6동',
    linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '통합돌봄',
    history: [
      {
        visitNo: 1, visitDate: '2026-08-02', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '통합돌봄',
        secondReferralDong: '동탄6동', counselingNote: '노인 돌봄 통합패키지 연계, 방문 건강관리 포함',
      },
    ],
  },
  {
    id: 'cr-016', seq: 16,
    orgName: '동탄6동 행정복지센터', regionId: 'dongtan',
    visitType: '재방문', clientName: '권○자',
    birthDate: '1968-09-17', address: '화성시 동탄5동 ○○대로 890',
    counselingDate: '2026-08-02', secondReferralDong: '동탄6동',
    linkageConducted: 'X', linkageStatus: '연계불요',
    note: '가족 돌봄 체계 확립, 공적 지원 불필요',
    history: [
      {
        visitNo: 1, visitDate: '2026-07-18', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '동탄6동', counselingNote: '가족 상황 파악 및 지원 욕구 조사',
      },
      {
        visitNo: 2, visitDate: '2026-08-02', visitType: '재방문',
        linkageConducted: 'X', linkageStatus: '연계불요',
        secondReferralDong: '동탄6동', counselingNote: '자녀 돌봄으로 가족 내 해결, 연계 불필요',
      },
    ],
  },
  {
    id: 'cr-017', seq: 17,
    orgName: '남양읍 행정복지센터', regionId: 'manse',
    visitType: '재방문', clientName: '황○식',
    birthDate: '1940-04-30', address: '화성시 남양읍 ○○로 56',
    counselingDate: '2026-08-01', secondReferralDong: '남양읍',
    linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '노인돌봄기본서비스',
    history: [
      {
        visitNo: 1, visitDate: '2026-06-05', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '남양읍', counselingNote: '80대 독거 남성, 일상생활 지원 필요',
      },
      {
        visitNo: 2, visitDate: '2026-07-03', visitType: '재방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '남양읍', counselingNote: '건강 상태 점검, 돌봄 서비스 신청 진행',
      },
      {
        visitNo: 3, visitDate: '2026-08-01', visitType: '재방문',
        linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '노인돌봄기본서비스',
        secondReferralDong: '남양읍', counselingNote: '노인돌봄기본서비스 및 식사 지원 연계 완료',
      },
    ],
  },
  {
    id: 'cr-018', seq: 18,
    orgName: '향남읍 행정복지센터', regionId: 'hyohaeng',
    visitType: '최초방문', clientName: '안○연',
    birthDate: '1978-12-03', address: '화성시 향남읍 ○○길 321',
    counselingDate: '2026-07-31', secondReferralDong: '향남읍',
    linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '긴급복지지원',
    history: [
      {
        visitNo: 1, visitDate: '2026-07-31', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '긴급복지지원',
        secondReferralDong: '향남읍', counselingNote: '화재 피해 가구, 긴급주거 및 생계 지원 즉시 연계',
      },
    ],
  },
  {
    id: 'cr-019', seq: 19,
    orgName: '봉담읍 행정복지센터', regionId: 'hyohaeng',
    visitType: '재방문', clientName: '송○범',
    birthDate: '1957-08-19', address: '화성시 봉담읍 ○○로 777',
    counselingDate: '2026-07-28', secondReferralDong: '봉담읍',
    linkageConducted: 'O', linkageStatus: '기타', linkageService: '민간 후원 연계',
    note: '종교단체 민간 후원 연결, 정기 방문 지원 예정',
    history: [
      {
        visitNo: 1, visitDate: '2026-07-01', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '봉담읍', counselingNote: '공적 지원 기준 미충족, 민간 자원 연계 방향 검토',
      },
      {
        visitNo: 2, visitDate: '2026-07-28', visitType: '재방문',
        linkageConducted: 'O', linkageStatus: '기타', linkageService: '민간 후원 연계',
        secondReferralDong: '봉담읍', counselingNote: '지역 종교단체 통해 정기 후원 및 방문 연결',
      },
    ],
  },
  {
    id: 'cr-020', seq: 20,
    orgName: '병점1동 행정복지센터', regionId: 'byeongjeom',
    visitType: '최초방문', clientName: '류○진',
    birthDate: '1993-02-11', address: '화성시 병점1동 ○○길 44',
    counselingDate: '2026-07-25', secondReferralDong: '병점1동',
    linkageConducted: 'X', linkageStatus: '검토중',
    note: '청년 1인 가구, 고립 우려 — 추적 관찰 필요',
    history: [
      {
        visitNo: 1, visitDate: '2026-07-25', visitType: '최초방문',
        linkageConducted: 'X', linkageStatus: '검토중',
        secondReferralDong: '병점1동', counselingNote: '청년 은둔형 외톨이, 외부 연계 거부 의사 표현',
      },
    ],
  },
  {
    id: 'cr-021', seq: 21,
    orgName: '화산동 행정복지센터', regionId: 'byeongjeom',
    visitType: '재방문', clientName: '전○아',
    birthDate: '1966-11-22', address: '화성시 화산동 ○○로 512',
    counselingDate: '2026-07-22', secondReferralDong: '화산동',
    linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '차상위계층 의료지원',
    history: [
      {
        visitNo: 1, visitDate: '2026-06-28', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '화산동', counselingNote: '중증 질환 치료 중, 차상위 해당 여부 심사 진행',
      },
      {
        visitNo: 2, visitDate: '2026-07-22', visitType: '재방문',
        linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '차상위계층 의료지원',
        secondReferralDong: '화산동', counselingNote: '차상위계층 의료비 지원 확정, 치료비 감면 적용',
      },
    ],
  },
  {
    id: 'cr-022', seq: 22,
    orgName: '동탄4동 행정복지센터', regionId: 'dongtan',
    visitType: '최초방문', clientName: '문○희',
    birthDate: '1949-05-07', address: '화성시 동탄3동 ○○대로 678',
    counselingDate: '2026-07-18', secondReferralDong: '동탄4동',
    linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '장애인활동지원',
    history: [
      {
        visitNo: 1, visitDate: '2026-07-18', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '장애인활동지원',
        secondReferralDong: '동탄4동', counselingNote: '지체장애 2급, 활동지원 서비스 연계 완료',
      },
    ],
  },
  {
    id: 'cr-023', seq: 23,
    orgName: '동탄6동 행정복지센터', regionId: 'dongtan',
    visitType: '재방문', clientName: '남○호',
    birthDate: '1974-07-29', address: '화성시 동탄6동 ○○로 901',
    counselingDate: '2026-07-15', secondReferralDong: '동탄6동',
    linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '반찬지원',
    history: [
      {
        visitNo: 1, visitDate: '2026-05-20', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '동탄6동', counselingNote: '신체 거동 불편, 음식 준비 어려움',
      },
      {
        visitNo: 2, visitDate: '2026-06-17', visitType: '재방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '동탄6동', counselingNote: '지역 자원 현황 파악 중',
      },
      {
        visitNo: 3, visitDate: '2026-07-15', visitType: '재방문',
        linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '반찬지원',
        secondReferralDong: '동탄6동', counselingNote: '지역 반찬 봉사단체 연결, 주 3회 지원',
      },
    ],
  },
  {
    id: 'cr-024', seq: 24,
    orgName: '팔탄면 행정복지센터', regionId: 'manse',
    visitType: '최초방문', clientName: '노○원',
    birthDate: '1985-01-16', address: '화성시 팔탄면 ○○길 32',
    counselingDate: '2026-07-10', secondReferralDong: '팔탄면',
    linkageConducted: 'X', linkageStatus: '연계불요',
    note: '현재 소득 안정적, 자발적 방문 후 연계 불필요 확인',
    history: [
      {
        visitNo: 1, visitDate: '2026-07-10', visitType: '최초방문',
        linkageConducted: 'X', linkageStatus: '연계불요',
        secondReferralDong: '팔탄면', counselingNote: '상담 후 현재 지원 불필요 확인',
      },
    ],
  },
  {
    id: 'cr-025', seq: 25,
    orgName: '남양읍 행정복지센터', regionId: 'manse',
    visitType: '재방문', clientName: '배○경',
    birthDate: '1962-03-24', address: '화성시 남양읍 ○○로 789',
    counselingDate: '2026-07-05', secondReferralDong: '남양읍',
    linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '주거급여',
    history: [
      {
        visitNo: 1, visitDate: '2026-06-10', visitType: '최초방문',
        linkageConducted: 'O', linkageStatus: '검토중',
        secondReferralDong: '남양읍', counselingNote: '노후 단독주택 거주, 주거 환경 개선 필요',
      },
      {
        visitNo: 2, visitDate: '2026-07-05', visitType: '재방문',
        linkageConducted: 'O', linkageStatus: '연계완료', linkageService: '주거급여',
        secondReferralDong: '남양읍', counselingNote: '주거급여 수선급여 신청 완료, 도배·장판 지원',
      },
    ],
  },
];
