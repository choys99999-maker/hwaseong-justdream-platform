import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import QuickStatusForm from '../components/sites/QuickStatusForm';

/**
 * 빠른 현황 입력 단독 화면.
 *
 * 거점 운영 > 거점 상세 > [빠른 입력] 탭과 같은 폼을 쓰되, 거점을 아직 고르지 않은
 * 상태에서 바로 들어올 수 있는 입구로 남겨 둔다(시연 역할 전환·현장 담당자 첫 화면).
 */
export default function QuickSiteStatusPage() {
  return (
    <div className="mx-auto w-full max-w-[640px] space-y-5">
      <Link
        to="/admin/sites"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-teal-600"
      >
        <ArrowLeft size={16} /> 거점 운영
      </Link>

      <PageHeader
        title="빠른 현황 입력"
        description="거점 → 상태 → 저장, 세 번이면 끝입니다. 저장하면 시민 화면에 바로 반영됩니다."
      />

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <QuickStatusForm />
      </div>
    </div>
  );
}
