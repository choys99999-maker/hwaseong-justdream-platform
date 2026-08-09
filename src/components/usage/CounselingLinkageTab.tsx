import { useMemo } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import DataTable from '../common/DataTable';
import CentralDataNotice from '../common/CentralDataNotice';
import EmptyState from '../common/EmptyState';
import { useCentralData } from '../../hooks/useCentralData';
import { listAllReferralRows, type CityReferralRow } from '../../store/analytics';
import { mockClients, mockVisits, mockWelfareReferrals } from '../../data/mockClientRecords';
import { resolveNextAction } from '../../utils/supportRecords';
import { displayCellValue } from '../../utils/submission';
import { formatDate, formatNumber } from '../../utils/format';
import type { ReferralStatus } from '../../types';

/**
 * [상담·복지연계] 탭 — 이용·지원 현황 페이지 안에서 쓴다.
 *
 * 위: 1차 이용 → 2차 상담 → 복지연계 → 지속지원 판정으로 이어지는 핵심 흐름 요약(시연 시드 기준).
 * 아래: 읍면동이 제출한 2차 연계 대상자 실제 자료(중앙 저장소).
 */

const REFERRAL_BADGE: Record<ReferralStatus, string> = {
  '미연계': 'bg-slate-50 text-slate-600 ring-slate-300',
  '연계요청': 'bg-sky-50 text-sky-700 ring-sky-600/20',
  '읍면동상담중': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  '연계완료': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  '연계불요': 'bg-white text-slate-500 ring-slate-200',
};

/** 흐름 요약 한 단계 */
function FunnelStep({
  label,
  value,
  unit,
  hint,
  isLast = false,
}: {
  label: string;
  value: number;
  unit: string;
  hint: string;
  isLast?: boolean;
}) {
  return (
    <>
      <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
        <p className="truncate text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">
          {formatNumber(value)}
          <span className="ml-0.5 text-xs font-normal text-slate-400">{unit}</span>
        </p>
        <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p>
      </div>
      {!isLast && <ArrowRight size={15} className="shrink-0 text-teal-500" />}
    </>
  );
}

/** 시 전체가 함께 보는 화면이라 개인 식별 항목은 가려서 보여준다. */
const referralColumns = [
  { key: 'orgName', header: '기관명', render: (row: CityReferralRow) => row.organizationName },
  { key: 'visitType', header: '방문구분', render: (row: CityReferralRow) => row.visitType ?? '-' },
  {
    key: 'clientName',
    header: '대상자',
    render: (row: CityReferralRow) => displayCellValue('대상자', row.clientName ?? '') || '-',
  },
  {
    key: 'birthDate',
    header: '생년월일',
    render: (row: CityReferralRow) => displayCellValue('생년월일', row.birthDate ?? '') || '-',
  },
  {
    key: 'address',
    header: '주소',
    render: (row: CityReferralRow) => displayCellValue('주소', row.address ?? '') || '-',
  },
  {
    key: 'consultDate',
    header: '상담일자',
    render: (row: CityReferralRow) => (row.consultDate ? formatDate(row.consultDate) : '-'),
  },
  {
    key: 'referralTarget',
    header: '2차 연계처(읍면동)',
    render: (row: CityReferralRow) => row.referralTarget ?? '-',
  },
  {
    key: 'consultationDone',
    header: '연계상담 실시 여부',
    render: (row: CityReferralRow) => row.consultationDone ?? '-',
  },
  { key: 'linkageType', header: '연계완료', render: (row: CityReferralRow) => row.linkageType ?? '-' },
  { key: 'serviceDetails', header: '기타 내역', render: (row: CityReferralRow) => row.serviceDetails ?? '-' },
];

export default function CounselingLinkageTab() {
  const { data, error, isLoading } = useCentralData(() => listAllReferralRows(), []);
  const referrals = data ?? [];

  // 핵심 흐름 요약 — 이용·상담 시연 시드에서 계산한다.
  const funnel = useMemo(() => {
    const counselingDone = mockVisits.filter((visit) => visit.basicCounseling?.conducted).length;
    const decided = mockWelfareReferrals.filter((referral) => referral.continuedSupport !== '미판정').length;
    return {
      firstVisit: mockClients.length,
      counselingDone,
      referralCount: mockWelfareReferrals.length,
      decided,
    };
  }, []);

  // 지금 진행 중이라 담당자 확인이 필요한 연계 건.
  const ongoing = useMemo(() => {
    const visitsByClient = new Map<string, typeof mockVisits>();
    for (const visit of mockVisits) {
      const list = visitsByClient.get(visit.clientId);
      if (list) list.push(visit);
      else visitsByClient.set(visit.clientId, [visit]);
    }
    return mockWelfareReferrals
      .filter((referral) => referral.status === '연계요청' || referral.status === '읍면동상담중')
      .map((referral) => {
        const client = mockClients.find((candidate) => candidate.id === referral.clientId);
        const visits = (visitsByClient.get(referral.clientId) ?? []).sort((a, b) => a.visitNo - b.visitNo);
        return { referral, client, nextAction: resolveNextAction(visits, referral) };
      })
      .filter((row) => row.client);
  }, []);

  return (
    <div className="space-y-5">
      {/* 핵심 흐름 요약 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="이용·연계 흐름 요약">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="text-sm font-semibold text-slate-900">이용 → 상담 → 복지연계 흐름</h3>
          <span className="rounded bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700 ring-1 ring-amber-600/20">
            시연 데이터
          </span>
          <span className="text-[11px] text-slate-400">이용 현황 탭의 이용자 기록 기준</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <FunnelStep label="1차 이용" value={funnel.firstVisit} unit="명" hint="물품지원 · 본인확인" />
          <FunnelStep label="2차 상담" value={funnel.counselingDone} unit="건" hint="기본상담 실시" />
          <FunnelStep label="복지연계" value={funnel.referralCount} unit="건" hint="읍면동 맞춤형복지팀" />
          <FunnelStep label="지속지원 판정" value={funnel.decided} unit="건" hint="가능·불가 판정 완료" isLast />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          단계별 집계 기준이 달라 건수가 순서대로 줄지 않을 수 있습니다. 서식상 1차 방문에서 연계상담이 시작된
          사례는 복지연계에 바로 집계됩니다.
        </p>
      </section>

      {/* 진행 중 연계 — 담당자 확인 대상 */}
      <section className="space-y-2" aria-label="진행 중인 복지연계">
        <h3 className="text-sm font-semibold text-slate-900">
          진행 중인 복지연계
          <span className="ml-1.5 text-xs font-normal text-slate-400">연계요청 · 읍면동 상담중 {ongoing.length}건</span>
        </h3>
        {ongoing.length === 0 ? (
          <EmptyState message="진행 중인 복지연계가 없습니다." />
        ) : (
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {ongoing.map(({ referral, client, nextAction }) => (
              <li
                key={referral.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-slate-800">{client?.nameMasked}</span>
                    <span className="text-xs text-slate-400">
                      {client?.birthYear}년생 · {referral.linkedDong || '연계처 미지정'}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">다음 조치 — {nextAction.label}</p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${REFERRAL_BADGE[referral.status]}`}
                >
                  {referral.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-slate-400">
          개별 이력·판정 입력은 [이용 현황] 탭에서 대상자를 선택해 진행합니다.
        </p>
      </section>

      {/* 중앙 저장소 — 읍면동 제출 2차 연계 대상자 */}
      <section className="space-y-3" aria-label="2차 연계 대상자">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              2차 연계 대상자
              <span className="ml-1.5 rounded bg-teal-50 px-1.5 py-px text-[10px] font-medium text-teal-700 ring-1 ring-teal-600/20">
                실제 제출 데이터
              </span>
            </h3>
            <p className="mt-1 text-sm text-slate-500">읍면동이 제출한 2차 상담 연계 의뢰 대상자별 상세 현황입니다.</p>
          </div>
          <p className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-500 ring-1 ring-inset ring-slate-200">
            <ShieldCheck size={14} className="text-slate-400" />
            이름·생년월일·상세 주소는 가려서 표시합니다.
          </p>
        </div>

        <CentralDataNotice
          isLoading={isLoading}
          error={error}
          isEmpty={referrals.length === 0}
          emptyMessage="아직 제출된 2차 연계 대상자 자료가 없습니다."
        />

        {referrals.length > 0 && (
          <DataTable
            columns={referralColumns}
            data={referrals}
            rowKey={(row) => `${row.organizationId}-${row.serialNo ?? ''}-${row.consultDate ?? ''}-${row.clientName ?? ''}`}
            emptyMessage="2차 연계 대상자가 없습니다."
          />
        )}
      </section>
    </div>
  );
}
