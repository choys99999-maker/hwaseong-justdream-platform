import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, PhoneIncoming } from 'lucide-react';
import { useCentralData } from '../../hooks/useCentralData';
import { listHelpRequests, resolveHelpRequest, type HelpRequest } from '../../store/helpRequests';

const VISIBLE_LIMIT = 4;

function formatReceivedAt(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * "오늘 확인할 요청" — 시민 `/help` 직접 입력과 담당자 전화 대리 입력이 같은 큐(help_requests)로
 * 들어오므로 여기서 채널 구분 없이 한 목록으로 보여준다. 대시보드 최상단에 둔다.
 */
export default function TodayHelpRequestSection() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, error, isLoading } = useCentralData(() => listHelpRequests(), [refreshKey]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  async function handleResolve(id: string) {
    setResolvingId(id);
    try {
      await resolveHelpRequest(id);
      refresh();
    } finally {
      setResolvingId(null);
    }
  }

  const requests: HelpRequest[] = (data ?? []).filter((r) => r.status === 'NEW');
  const visible = requests.slice(0, VISIBLE_LIMIT);
  const restCount = requests.length - visible.length;

  if (isLoading || error) {
    // 중앙 저장소 연결 전(개발 초기)이거나 마이그레이션 적용 전에는 이 구역만 조용히 숨긴다 —
    // 시민 요청 큐는 아직 준비 중이라는 뜻이지 오류로 화면 전체를 막을 일은 아니다.
    return null;
  }

  return (
    <section aria-label="오늘 확인할 요청" className="rounded-xl border border-teal-200 bg-teal-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900">오늘 확인할 요청</h3>
          {requests.length > 0 && (
            <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[11px] font-semibold text-white">
              {requests.length}건
            </span>
          )}
        </div>
        <Link
          to="/admin/help-requests/new"
          className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <PhoneIncoming size={13} />
          전화로 받은 요청 대신 입력
          <ArrowRight size={13} />
        </Link>
      </div>

      {visible.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-teal-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
          새 도움 요청이 없습니다.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {visible.map((req) => (
            <li key={req.id} className="rounded-lg border border-teal-100 bg-white px-4 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-800">{req.dong}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-sm text-slate-600">{req.itemCategory} 필요</span>
                    {req.channel === 'PHONE' && (
                      <span className="rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">
                        전화 접수
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {req.phone} · {formatReceivedAt(req.createdAt)} 접수
                  </p>
                  {req.message && <p className="mt-1 text-xs text-slate-500">"{req.message}"</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleResolve(req.id)}
                  disabled={resolvingId === req.id}
                  className="flex shrink-0 items-center gap-1 self-center rounded-lg border border-teal-200 px-2.5 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  <Check size={13} />
                  확인
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {restCount > 0 && <p className="mt-2 text-right text-[11px] text-slate-400">외 {restCount}건</p>}
    </section>
  );
}
