import { useMemo, useState } from 'react';
import DataTable from '../components/common/DataTable';
import CentralDataNotice from '../components/common/CentralDataNotice';
import { useCentralData } from '../hooks/useCentralData';
import { listPerformanceRows, type PerformanceRow } from '../store/analytics';
import { districtOfArea } from '../data/districtByArea';
import { REGION_NAMES } from '../data/regionMeta';
import { formatNumber } from '../utils/format';

/**
 * [지원 실적] 탭 — 이용·지원 현황 페이지 안에서 쓴다.
 * 화성형 그냥드림 실적 서식 기준 주별·누적 실적. 2차 연계 대상자 표는
 * [상담·복지연계] 탭(`CounselingLinkageTab`)으로 옮겼다.
 */
type TabKey = 'weekly' | 'cumulative';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'weekly', label: '주별 실적' },
  { key: 'cumulative', label: '누계' },
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

export default function PerformanceRecordsTab() {
  const [activeTab, setActiveTab] = useState<TabKey>('weekly');

  const { data, error, isLoading } = useCentralData(() => listPerformanceRows(), []);

  const weekly = useMemo(() => aggregate(latestSubmissionRows(data ?? [])), [data]);
  const cumulative = useMemo(() => aggregate(data ?? []), [data]);

  return (
    <div className="space-y-4">
      <CentralDataNotice
        isLoading={isLoading}
        error={error}
        isEmpty={weekly.length === 0}
        emptyMessage="아직 올라온 실적 자료가 없습니다."
      />

      {weekly.length > 0 && (
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
        </>
      )}
    </div>
  );
}
