import { Link } from 'react-router-dom';
import { AlertTriangle, FileUp, Loader2 } from 'lucide-react';

/**
 * 중앙 저장소(Supabase)에서 읽어오는 구역의 로딩·오류·빈 상태 안내.
 *
 * 화면 전체를 대체하지 않고 해당 구역만 대신 그린다. 지도·거점 현황처럼
 * 중앙 DB와 무관한 부분은 계속 보여야 하기 때문이다.
 */
interface CentralDataNoticeProps {
  isLoading: boolean;
  error: string | null;
  /** 조회는 됐지만 아직 올라온 자료가 없는 상태 */
  isEmpty?: boolean;
  emptyMessage?: string;
}

export default function CentralDataNotice({
  isLoading,
  error,
  isEmpty = false,
  emptyMessage = '자료 관리에서 Excel 파일을 올리면 이 영역에 실제 값이 표시됩니다.',
}: CentralDataNoticeProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-400">
        <Loader2 size={16} className="animate-spin" />
        중앙 저장소에서 불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
        <span>{error}</span>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
        <span>{emptyMessage}</span>
        <Link
          to="/files/upload"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <FileUp size={14} /> 자료 올리기
        </Link>
      </div>
    );
  }

  return null;
}
