import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import CentralDataNotice from '../components/common/CentralDataNotice';
import { useCentralData } from '../hooks/useCentralData';
import {
  listAllReferralRows,
  listPerformanceRows,
  type CityReferralRow,
  type PerformanceRow,
} from '../store/analytics';
import { districtOfArea } from '../data/districtByArea';
import { REGION_NAMES } from '../data/regionMeta';
import { displayCellValue } from '../utils/submission';
import { formatDate, formatNumber } from '../utils/format';

type TabKey = 'weekly' | 'cumulative' | 'referral';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'weekly', label: '주별 실적' },
  { key: 'cumulative', label: '누계' },
  { key: 'referral', label: '2차 연계 대상자' },
];

/** 실적 표 한 줄 = 제출 기관(읍면동) × 실적 서식의 기관명. */
interface PerfRow {
  id: string;
  orgName: string;
  districtName: string;
  userCount: number;
  basicConsultation: number;
  referralTotal: number;
  basicLivelihood: number;
  nearPoverty: number;
  emergencyWelfare: number;
  otherLinkage: number;
  underReview: number;
  noLinkageNeeded: number;
}

function districtNameOf(organizationName: string, fallback: string): string {
  const id = districtOfArea(organizationName);
  return id ? REGION_NAMES[id] : fallback;
}

/** 기관 단위로 합친다. 누계 시트는 view 단계에서 이미 빠져 있어 이중 계산이 없다. */
function aggregate(rows: PerformanceRow[]): PerfRow[] {
  const byKey = new Map<string, PerfRow>();

  for (const row of rows) {
    const orgName = row.institution?.trim() || row.organizationName;
    const key = `${row.organizationId}::${orgName}`;
    const acc = byKey.get(key);
    if (acc) {
      acc.userCount += row.userCount;
      acc.basicConsultation += row.basicConsultation;
      acc.referralTotal += row.referralTotal;
      acc.basicLivelihood += row.basicLivelihood;
      acc.nearPoverty += row.nearPoverty;
      acc.emergencyWelfare += row.emergencyWelfare;
      acc.otherLinkage += row.otherLinkage;
      acc.underReview += row.underReview;
      acc.noLinkageNeeded += row.noLinkageNeeded;
      continue;
    }
    byKey.set(key, {
      id: key,
      orgName,
      districtName: districtNameOf(row.organizationName, row.regionName),
      userCount: row.userCount,
      basicConsultation: row.basicConsultation,
      referralTotal: row.referralTotal,
      basicLivelihood: row.basicLivelihood,
      nearPoverty: row.nearPoverty,
      emergencyWelfare: row.emergencyWelfare,
      otherLinkage: row.otherLinkage,
      underReview: row.underReview,
      noLinkageNeeded: row.noLinkageNeeded,
    });
  }

  return Array.from(byKey.values()).sort(
    (a, b) => b.userCount - a.userCount || a.orgName.localeCompare(b.orgName, 'ko'),
  );
}

/** 각 읍면동의 가장 최근 제출본 행만 남긴다. (= 그 주에 제출된 실적) */
function latestSubmissionRows(rows: PerformanceRow[]): PerformanceRow[] {
  const latestAt = new Map<string, string>();
  for (const row of rows) {
    const current = latestAt.get(row.organizationId);
    if (!current || row.uploadedAt > current) latestAt.set(row.organizationId, row.uploadedAt);
  }
  return rows.filter((row) => latestAt.get(row.organizationId) === row.uploadedAt);
}

const performanceColumns = [
  { key: 'orgName', header: '기관명', render: (row: PerfRow) => row.orgName },
  { key: 'districtName', header: '지역', render: (row: PerfRow) => row.districtName },
  { key: 'userCount', header: '이용자 수', render: (row: PerfRow) => `${formatNumber(row.userCount)}명` },
  {
    key: 'basicConsultation',
    header: '기본상담(2차 이용)',
    render: (row: PerfRow) => `${formatNumber(row.basicConsultation)}건`,
  },
  {
    key: 'referralTotal',
    header: '상담 연계 의뢰',
    render: (row: PerfRow) => `${formatNumber(row.referralTotal)}건`,
  },
  { key: 'basicLivelihood', header: '기초생활', render: (row: PerfRow) => `${formatNumber(row.basicLivelihood)}건` },
  { key: 'nearPoverty', header: '차상위', render: (row: PerfRow) => `${formatNumber(row.nearPoverty)}건` },
  {
    key: 'emergencyWelfare',
    header: '긴급복지',
    render: (row: PerfRow) => `${formatNumber(row.emergencyWelfare)}건`,
  },
  { key: 'otherLinkage', header: '기타', render: (row: PerfRow) => `${formatNumber(row.otherLinkage)}건` },
  { key: 'underReview', header: '검토중', render: (row: PerfRow) => `${formatNumber(row.underReview)}건` },
  {
    key: 'noLinkageNeeded',
    header: '연계불요',
    render: (row: PerfRow) => `${formatNumber(row.noLinkageNeeded)}건`,
  },
];

/**
 * 2차 연계 대상자 — 시 전체가 함께 보는 화면이라 개인 식별 항목은 가려서 보여준다.
 * 이름은 첫 글자만, 생년월일·연락처는 비공개, 주소는 읍면동까지만.
 */
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

export default function PerformancePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('weekly');

  const { data, error, isLoading } = useCentralData(
    () =>
      Promise.all([listPerformanceRows(), listAllReferralRows()]).then(([performance, referrals]) => ({
        performance,
        referrals,
      })),
    [],
  );

  const weekly = useMemo(() => aggregate(latestSubmissionRows(data?.performance ?? [])), [data]);
  const cumulative = useMemo(() => aggregate(data?.performance ?? []), [data]);
  const referrals = useMemo(() => data?.referrals ?? [], [data]);

  const hasAnything = weekly.length > 0 || referrals.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="실적·복지연계"
        description="화성형 그냥드림 실적 서식을 기준으로 주별·누적 실적과 2차 연계 대상자를 확인합니다. 중앙 저장소에 올라온 자료를 집계합니다."
      />

      <CentralDataNotice
        isLoading={isLoading}
        error={error}
        isEmpty={!hasAnything}
        emptyMessage="아직 올라온 실적 자료가 없습니다."
      />

      {hasAnything && (
        <>
          <div className="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                aria-pressed={activeTab === tab.key}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                  activeTab === tab.key
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'weekly' && (
            <section className="space-y-3">
              <p className="text-sm text-slate-500">
                읍면동별 가장 최근 제출본 기준 이용자 수, 상담, 복지서비스 연계 현황입니다.
              </p>
              <DataTable
                columns={performanceColumns}
                data={weekly}
                rowKey={(row) => row.id}
                emptyMessage="주별 실적 데이터가 없습니다."
              />
            </section>
          )}

          {activeTab === 'cumulative' && (
            <section className="space-y-3">
              <p className="text-sm text-slate-500">
                유효한 모든 제출본을 합친 누적 현황입니다. 재제출로 대체된 자료와 파일 안의 누계 시트는
                집계에서 제외되므로 같은 실적이 두 번 더해지지 않습니다.
              </p>
              <DataTable
                columns={performanceColumns}
                data={cumulative}
                rowKey={(row) => row.id}
                emptyMessage="누적 실적 데이터가 없습니다."
              />
            </section>
          )}

          {activeTab === 'referral' && (
            <section className="space-y-3">
              <p className="text-sm text-slate-500">2차 상담 연계가 의뢰된 대상자별 상세 현황입니다.</p>
              <p className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-500 ring-1 ring-inset ring-slate-200">
                <ShieldCheck size={14} className="text-slate-400" />
                시 전체가 함께 보는 화면이므로 이름·생년월일·상세 주소는 가려서 표시합니다.
              </p>
              <DataTable
                columns={referralColumns}
                data={referrals}
                rowKey={(row) => `${row.organizationId}-${row.serialNo ?? ''}-${row.consultDate ?? ''}-${row.clientName ?? ''}`}
                emptyMessage="2차 연계 대상자가 없습니다."
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
