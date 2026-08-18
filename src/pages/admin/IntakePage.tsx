import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import HelpRequestPanel from '../../components/intake/HelpRequestPanel';
import DonationPanel from '../../components/intake/DonationPanel';
import CounselingLinkageTab from '../../components/usage/CounselingLinkageTab';
import SupportRecordsPage from '../SupportRecordsPage';

type TabKey = 'help' | 'donation' | 'usage';
type UsageView = 'records' | 'linkage';

/** 사이드바에서 오는 사람이 보는 탭은 둘뿐이다. */
const TABS: { key: TabKey; label: string }[] = [
  { key: 'help', label: '도움 요청' },
  { key: 'donation', label: '기부' },
];

const USAGE_VIEWS: { key: UsageView; label: string }[] = [
  { key: 'records', label: '이용 이력·상담' },
  { key: 'linkage', label: '복지연계' },
];

function resolveTab(value: string | null): TabKey {
  if (value === 'donation') return 'donation';
  // 이용·연계는 메뉴에서 내렸지만 예전 주소(`/admin/usage`)로 들어온 기록은 계속 열린다.
  if (value === 'usage') return 'usage';
  return 'help';
}

function resolveUsageView(value: string | null): UsageView {
  return value === 'linkage' ? 'linkage' : 'records';
}

/**
 * 시민 요청.
 *
 * 시민이 보낸 건은 두 종류뿐이다 — 도움 요청과 기부. 그래서 탭도 둘뿐이다.
 * 두 탭은 각자의 제목·상황 문장·요약을 스스로 그린다. 도움 요청은 "몇 건 처리하면 되는가",
 * 기부는 "무엇이 들어왔고 어디로 보내는가"로 첫 문장이 다르기 때문이다.
 *
 * 이용 이력·복지연계는 지우지 않되(주소로는 그대로 열린다) 매일 쓰는 화면에서 내렸다.
 */
export default function IntakePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveTab(searchParams.get('tab'));
  const usageView = resolveUsageView(searchParams.get('view'));

  function selectTab(key: TabKey) {
    // 탭을 바꾸면 이전 탭에서 고른 건(id)·하위 화면(view)은 따라오지 않는다.
    setSearchParams(key === 'help' ? {} : { tab: key }, { replace: true });
  }

  function selectUsageView(key: UsageView) {
    setSearchParams(key === 'records' ? { tab: 'usage' } : { tab: 'usage', view: key }, { replace: true });
  }

  const screenTabs = (
    <div
      className="inline-flex gap-1 rounded-xl border border-[rgba(20,50,80,0.08)] bg-white p-1"
      role="tablist"
      aria-label="시민 요청 탭"
    >
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.key}
          onClick={() => selectTab(tab.key)}
          className={`rounded-lg px-4 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] ${
            activeTab === tab.key
              ? 'bg-[#EAF3FC] text-[#004696]'
              : 'text-[#667085] hover:bg-[#F3F6FA] hover:text-[#182230]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  if (activeTab === 'help') return <HelpRequestPanel screenTabs={screenTabs} />;
  if (activeTab === 'donation') return <DonationPanel screenTabs={screenTabs} />;

  // 예전 주소로 들어온 이용·연계 기록. 탭 목록에는 두지 않는다.
  return (
    <div className="space-y-5">
      <PageHeader
        title="시민 요청"
        description="이용 이력·상담·복지연계 기록입니다. 시청 관리자 기본 흐름에서는 쓰지 않습니다."
      />

      <div
        className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-sm"
        role="group"
        aria-label="이용·연계 화면 선택"
      >
        {USAGE_VIEWS.map((view) => (
          <button
            key={view.key}
            type="button"
            onClick={() => selectUsageView(view.key)}
            aria-pressed={usageView === view.key}
            className={`rounded-md px-3.5 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] ${
              usageView === view.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {usageView === 'records' ? <SupportRecordsPage /> : <CounselingLinkageTab />}
    </div>
  );
}
