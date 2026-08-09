import type {
  Client,
  CounselingRecord,
  CounselingVisit,
  LinkageCompletionType,
  ReferralStatus,
  SupportDecision,
  SupportItem,
  Visit,
  WelfareReferral,
} from '../types';
import { mockCounselingRecords } from './mockCounselingRecords';
import { mockSites } from './mockSites';
import { SUPPORT_ITEM_CATALOG } from './supportItemCatalog';
import { birthYearOf, extractDong, maskKoreanName, toVisitStage } from '../utils/supportRecords';

/**
 * 화성시 2차 연계 대상자 서식 시드(`mockCounselingRecords.ts`, 25건)를
 * Client / Visit / WelfareReferral 도메인 모델로 한 번 변환한다.
 *
 * 원본 시드 파일은 손대지 않는다. 서식이 갱신되면 이 변환기만 고치면 된다.
 *
 * 시드에 없어서 이 변환기가 채우는 값 (전부 시연용):
 *   - identityVerified   : 그냥드림은 본인확인 후 이용하므로 true
 *   - checklistCompleted : 자가 체크리스트는 1차에서만 작성 → visitNo === 1
 *   - supportItems       : 시드에 물품 기록이 없어 카탈로그에서 결정론적으로 3~5개 배정
 *   - supportDecision    : 시드 메모상 '서류 미비/연계 거부' 건만 '보류', 나머지 '지원'
 */

// ─── 기관명 → 그냥드림 사업장 25개소 ─────────────────────────────────────────
//
// 시드의 기관명 8개 중 6개는 25개소의 지역사회보장협의체와 1:1 로 대응한다.
// 팔탄면·화산동 '행정복지센터' 두 곳은 25개소에 없는 기관이다.
// (`justdream_sites_25.ts` 는 실적 엑셀 기준 source of truth 라 임의로 늘리지 않는다)
// 시드를 버리지 않으려고 같은 구의 실제 사업장으로 옮겨 붙였다.
const SEED_ORG_TO_SITE_ID: Record<string, string> = {
  '남양읍 행정복지센터': 'justdream-12', // 남양읍지역사회보장협의체
  '향남읍 행정복지센터': 'justdream-11', // 향남읍지역사회보장협의체
  '봉담읍 행정복지센터': 'justdream-13', // 봉담읍지역사회보장협의체
  '병점1동 행정복지센터': 'justdream-19', // 병점1동지역사회보장협의체
  '동탄4동 행정복지센터': 'justdream-21', // 동탄4동지역사회보장협의체
  '동탄6동 행정복지센터': 'justdream-22', // 동탄6동지역사회보장협의체
  '팔탄면 행정복지센터': 'justdream-10', // → 만세구 우정읍지역사회보장협의체 (팔탄면에는 사업장 없음)
  '화산동 행정복지센터': 'justdream-09', // → 병점구 화성시정조효노인복지관 (화산동 소재)
};

function resolveSite(orgName: string) {
  const siteId = SEED_ORG_TO_SITE_ID[orgName];
  const site = siteId ? mockSites.find((candidate) => candidate.id === siteId) : undefined;
  // 조용한 fallback 을 두지 않는다. 매핑이 빠지면 지역 통계가 말없이 오염된다.
  if (!site) throw new Error(`mockClientRecords: 기관 '${orgName}' 을 25개소에 매핑하지 못했습니다.`);
  return site;
}

// ─── 시연용 물품 배정 ────────────────────────────────────────────────────────
// 방문마다 3~5개. 인덱스로만 정하므로 새로고침해도 값이 흔들리지 않는다.
function demoSupportItems(seedIndex: number, visitNo: number): SupportItem[] {
  const count = 3 + ((seedIndex + visitNo) % 3);
  const items: SupportItem[] = [];

  for (let offset = 0; offset < count; offset += 1) {
    const entry = SUPPORT_ITEM_CATALOG[(seedIndex * 3 + visitNo + offset) % SUPPORT_ITEM_CATALOG.length];
    items.push({
      itemId: entry.itemId,
      itemName: entry.itemName,
      quantity: 1 + ((offset + visitNo) % 2),
      unit: entry.unit,
    });
  }

  return items;
}

function toSupportDecision(visit: CounselingVisit): SupportDecision {
  // 시드 메모상 '서류 미비 / 외부 연계 거부' 로 판단이 미뤄진 건들
  return visit.linkageConducted === 'X' && visit.linkageStatus === '검토중' ? '보류' : '지원';
}

// ─── 연계 상태 변환 ──────────────────────────────────────────────────────────
// 서식 4값('연계완료' | '검토중' | '연계불요' | '기타') → 운영 5단계
function toReferralStatus(record: CounselingRecord): ReferralStatus {
  switch (record.linkageStatus) {
    case '연계완료':
      return '연계완료';
    case '연계불요':
      return '연계불요';
    case '기타':
      // 민간 후원 등으로 연결이 끝난 건. 유형만 '기타' 로 남긴다.
      return '연계완료';
    case '검토중':
      // 연계상담을 실시했으면 읍면동이 보고 있는 상태, 아니면 아직 넘기지 않은 상태다.
      return record.linkageConducted === 'O' ? '읍면동상담중' : '미연계';
  }
}

function toLinkageType(service: string | undefined, status: ReferralStatus): LinkageCompletionType | undefined {
  if (status === '연계불요') return '해당없음';
  if (!service) return undefined;
  if (service.includes('생계급여') || service.includes('기초')) return '기초생활';
  if (service.includes('차상위')) return '차상위';
  if (service.includes('긴급복지')) return '긴급복지';
  return '기타';
}

// ─── 변환 ────────────────────────────────────────────────────────────────────
interface SeedResult {
  clients: Client[];
  visits: Visit[];
  referrals: WelfareReferral[];
}

function convert(records: CounselingRecord[]): SeedResult {
  const clients: Client[] = [];
  const visits: Visit[] = [];
  const referrals: WelfareReferral[] = [];

  records.forEach((record, seedIndex) => {
    const site = resolveSite(record.orgName);
    const clientId = `cl-${String(seedIndex + 1).padStart(3, '0')}`;
    const history = [...record.history].sort((a, b) => a.visitNo - b.visitNo);

    // 방문
    const clientVisits: Visit[] = history.map((entry) => ({
      id: `vs-${clientId}-${entry.visitNo}`,
      clientId,
      visitNo: entry.visitNo,
      visitStage: toVisitStage(entry.visitNo),
      visitDate: entry.visitDate,
      siteId: site.id,
      orgName: site.name,
      identityVerified: true,
      checklistCompleted: entry.visitNo === 1,
      supportDecision: toSupportDecision(entry),
      supportItems: demoSupportItems(seedIndex, entry.visitNo),
      basicCounseling: entry.counselingNote
        ? {
            // 1차는 접수 메모만 남은 것으로 보고 기본상담은 2차부터로 잡는다.
            conducted: entry.visitNo >= 2,
            note: entry.counselingNote,
            needsAdditionalSupport: entry.linkageConducted === 'O',
          }
        : undefined,
    }));

    // 복지연계 — 연계상담을 한 번이라도 실시했거나 연계불요로 종결된 건만 만든다.
    const status = toReferralStatus(record);
    const requestedVisit = history.find((entry) => entry.linkageConducted === 'O');
    const hasReferral = Boolean(requestedVisit) || status === '연계불요';

    if (hasReferral) {
      const originEntry = requestedVisit ?? history[history.length - 1];
      const originVisit = clientVisits.find((visit) => visit.visitNo === originEntry.visitNo)!;
      const completedEntry = [...history].reverse().find((entry) => entry.linkageStatus === '연계완료');
      const referralId = `rf-${clientId}`;

      referrals.push({
        id: referralId,
        clientId,
        originVisitId: originVisit.id,
        status,
        linkedDong: record.secondReferralDong,
        requestedAt: requestedVisit?.visitDate,
        dongCounselingDoneAt: status === '연계완료' ? completedEntry?.visitDate ?? record.counselingDate : undefined,
        linkageType: toLinkageType(record.linkageService, status),
        linkageService: record.linkageService,
        continuedSupport: status === '연계완료' ? '가능' : status === '연계불요' ? '불가' : '미판정',
        resultNote: record.note,
        updatedAt: record.counselingDate,
      });

      originVisit.referralId = referralId;
    }

    visits.push(...clientVisits);

    // 이용자
    clients.push({
      id: clientId,
      nameMasked: maskKoreanName(record.clientName),
      birthYear: birthYearOf(record.birthDate),
      birthDate: record.birthDate,
      residenceDong: extractDong(record.address) || record.secondReferralDong,
      addressDetail: record.address,
      regionId: site.district,
      firstVisitDate: history[0].visitDate,
      lastVisitDate: history[history.length - 1].visitDate,
      visitCount: history.length,
    });
  });

  return { clients, visits, referrals };
}

const seed = convert(mockCounselingRecords);

export const mockClients: Client[] = seed.clients;
export const mockVisits: Visit[] = seed.visits;
export const mockWelfareReferrals: WelfareReferral[] = seed.referrals;
