import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import HelpRequestPanel from '../../components/intake/HelpRequestPanel';
import DonationPanel from '../../components/intake/DonationPanel';
import CounselingLinkageTab from '../../components/usage/CounselingLinkageTab';
import SupportRecordsPage from '../SupportRecordsPage';

type TabKey = 'help' | 'donation' | 'usage';
type UsageView = 'records' | 'linkage';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'help', label: '도움 요청' },
  { key: 'donation', label: '기부' },
  { key: 'usage', label: '이용·연계' },
];

const USAGE_VIEWS: { key: UsageView; label: string }[] = [
  { key: 'records', label: '이용 이력·상담' },
  { key: 'linkage', label: '복지연계' },
];

const DESCRIPTIONS: Record<TabKey, string> = {
  help: '시민이 모바일에서 넣은 요청과 전화로 받아 대신 넣은 요청이 함께 들어옵니다.',
  donation: '시민이 사진과 함께 남긴 물품 기부입니다. 품목·수량은 기부자가 최종 확인한 값입니다.',
  usage: '이용 이력·상담·복지연계·지속지원을 관리합니다. 심사·행정처리는 행복e음에서 진행합니다.',
};

function resolveTab(value: string | null): TabKey {
  return TABS.some((tab) => tab.key === value) ? (value as TabKey) : 'help';
}

function resolveUsageView(value: string | null): UsageView {
  return value === 'linkage' ? 'linkage' : 'records';
}

/**
 * 시민 접수.
 *
 * 흩어져 있던 신청·상담 내역 · 이용·지원 현황 · 복지연계 현황을 한 메뉴로 합쳤다.
 * 상단 탭은 셋뿐이고, 매일 처리해야 하는 도움 요청이 첫 탭이다.
 * 이용 이력·복지연계는 지우지 않되 주인공 자리에 두지 않는다.
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

  return (
    <div className="space-y-5">
      <PageHeader title="시민 접수" description={DESCRIPTIONS[activeTab]} />

      <div className="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1" role="tablist" aria-label="시민 접수 탭">
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

      {activeTab === 'help' && <HelpRequestPanel />}
      {activeTab === 'donation' && <DonationPanel />}

      {activeTab === 'usage' && (
        <div className="space-y-4">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-sm" role="group" aria-label="이용·연계 화면 선택">
            {USAGE_VIEWS.map((view) => (
              <button
                key={view.key}
                type="button"
                onClick={() => selectUsageView(view.key)}
                aria-pressed={usageView === view.key}
                className={`rounded-md px-3.5 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                  usageView === view.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>

          {usageView === 'records' ? <SupportRecordsPage /> : <CounselingLinkageTab />}
        </div>
      )}
    </div>
  );
}
