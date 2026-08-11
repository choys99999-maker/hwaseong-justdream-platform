import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import SupportRecordsPage from './SupportRecordsPage';
import PerformanceRecordsTab from './PerformancePage';

/**
 * 이용·지원 현황 — 이용자 관리(구 이용·상담 관리)와 실적을 한 화면으로 통합.
 * 복지연계 진행 상태는 별도 메뉴(복지연계 현황)로 분리했다.
 *
 * [이용 현황]  이용자 등록·방문·물품지원·상세 이력 (세션 시연 데이터)
 * [지원 실적]  실적 서식 기준 주별·누적 실적 (중앙 저장소)
 */
type TabKey = 'usage' | 'records';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'usage', label: '이용 현황' },
  { key: 'records', label: '지원 실적' },
];

function resolveTab(value: string | null): TabKey {
  return value === 'records' ? value : 'usage';
}

export default function UsageSupportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveTab(searchParams.get('tab'));

  function selectTab(key: TabKey) {
    setSearchParams(key === 'usage' ? {} : { tab: key }, { replace: true });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="이용·지원 현황"
        description="이용자 등록·방문·물품지원 현황과 실적을 관리합니다. 복지연계 진행 상태는 [복지연계 현황] 메뉴에서 확인합니다."
      />

      <div
        className="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1"
        role="tablist"
        aria-label="이용·지원 현황 탭"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => selectTab(tab.key)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              activeTab === tab.key
                ? 'bg-teal-50 text-teal-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'usage' && <SupportRecordsPage />}
      {activeTab === 'records' && <PerformanceRecordsTab />}
    </div>
  );
}
