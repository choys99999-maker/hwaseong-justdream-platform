import { useState } from 'react';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { mockWeeklyPerformance, mockCumulativePerformance, mockSecondReferralCases } from '../data/mockPerformance';
import { REGION_NAMES } from '../data/regionMeta';
import { formatDate, formatNumber } from '../utils/format';
import type { OrgPerformanceRecord, SecondReferralCase } from '../types';

type TabKey = 'weekly' | 'cumulative' | 'referral';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'weekly', label: '주별 실적' },
  { key: 'cumulative', label: '누계' },
  { key: 'referral', label: '2차 연계 대상자' },
];

const performanceColumns = [
  { key: 'orgName', header: '기관명', render: (row: OrgPerformanceRecord) => row.orgName },
  { key: 'regionName', header: '지역', render: (row: OrgPerformanceRecord) => REGION_NAMES[row.regionId] },
  { key: 'userCount', header: '이용자 수', render: (row: OrgPerformanceRecord) => `${formatNumber(row.userCount)}명` },
  {
    key: 'basicCounselingCount',
    header: '기본상담(2차 이용)',
    render: (row: OrgPerformanceRecord) => `${formatNumber(row.basicCounselingCount)}건`,
  },
  {
    key: 'counselingReferralCount',
    header: '상담 연계 의뢰',
    render: (row: OrgPerformanceRecord) => `${formatNumber(row.counselingReferralCount)}건`,
  },
  {
    key: 'basicLivelihood',
    header: '기초생활',
    render: (row: OrgPerformanceRecord) => `${formatNumber(row.welfareLinkageCompleted.basicLivelihood)}건`,
  },
  {
    key: 'nearPoor',
    header: '차상위',
    render: (row: OrgPerformanceRecord) => `${formatNumber(row.welfareLinkageCompleted.nearPoor)}건`,
  },
  {
    key: 'emergencyWelfare',
    header: '긴급복지',
    render: (row: OrgPerformanceRecord) => `${formatNumber(row.welfareLinkageCompleted.emergencyWelfare)}건`,
  },
  {
    key: 'other',
    header: '기타',
    render: (row: OrgPerformanceRecord) => `${formatNumber(row.welfareLinkageCompleted.other)}건`,
  },
  {
    key: 'underReviewCount',
    header: '검토중',
    render: (row: OrgPerformanceRecord) => `${formatNumber(row.underReviewCount)}건`,
  },
  {
    key: 'noLinkageNeededCount',
    header: '연계불요',
    render: (row: OrgPerformanceRecord) => `${formatNumber(row.noLinkageNeededCount)}건`,
  },
];

const referralColumns = [
  { key: 'orgName', header: '기관명', render: (row: SecondReferralCase) => row.orgName },
  { key: 'visitType', header: '방문구분', render: (row: SecondReferralCase) => row.visitType },
  { key: 'clientName', header: '대상자', render: (row: SecondReferralCase) => row.clientName },
  { key: 'birthDate', header: '생년월일', render: (row: SecondReferralCase) => formatDate(row.birthDate) },
  { key: 'address', header: '주소', render: (row: SecondReferralCase) => row.address },
  { key: 'counselingDate', header: '상담일자', render: (row: SecondReferralCase) => formatDate(row.counselingDate) },
  { key: 'secondReferralDong', header: '2차 연계처(읍면동)', render: (row: SecondReferralCase) => row.secondReferralDong },
  { key: 'linkageConducted', header: '연계상담 실시 여부', render: (row: SecondReferralCase) => row.linkageConducted },
  { key: 'linkageCompletionType', header: '연계완료', render: (row: SecondReferralCase) => row.linkageCompletionType },
  { key: 'note', header: '기타 내역', render: (row: SecondReferralCase) => row.note ?? '-' },
  { key: 'underReview', header: '검토중', render: (row: SecondReferralCase) => (row.underReview ? 'O' : '-') },
  { key: 'noLinkageNeeded', header: '연계불요', render: (row: SecondReferralCase) => (row.noLinkageNeeded ? 'O' : '-') },
];

export default function PerformancePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('weekly');

  return (
    <div className="space-y-6">
      <PageHeader
        title="실적·복지연계"
        description="화성형 그냥드림 실적 서식을 기준으로 주별·누적 실적과 2차 연계 대상자를 확인합니다."
      />

      <div className="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            aria-pressed={activeTab === tab.key}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              activeTab === tab.key ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'weekly' && (
        <section className="space-y-3">
          <p className="text-sm text-slate-500">기관별 주간 이용자 수, 상담, 복지서비스 연계 현황입니다.</p>
          <DataTable
            columns={performanceColumns}
            data={mockWeeklyPerformance}
            rowKey={(row) => row.id}
            emptyMessage="주별 실적 데이터가 없습니다."
          />
        </section>
      )}

      {activeTab === 'cumulative' && (
        <section className="space-y-3">
          <p className="text-sm text-slate-500">기관별 누적 이용자 수와 복지서비스 연계 현황입니다.</p>
          <DataTable
            columns={performanceColumns}
            data={mockCumulativePerformance}
            rowKey={(row) => row.id}
            emptyMessage="누적 실적 데이터가 없습니다."
          />
        </section>
      )}

      {activeTab === 'referral' && (
        <section className="space-y-3">
          <p className="text-sm text-slate-500">2차 상담 연계가 의뢰된 대상자별 상세 현황입니다.</p>
          <DataTable
            columns={referralColumns}
            data={mockSecondReferralCases}
            rowKey={(row) => row.id}
            emptyMessage="2차 연계 대상자가 없습니다."
          />
        </section>
      )}
    </div>
  );
}
