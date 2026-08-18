import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, PhoneIncoming, X } from 'lucide-react';
import CentralDataNotice from '../common/CentralDataNotice';
import StatusBadge from '../common/StatusBadge';
import { useCentralData } from '../../hooks/useCentralData';
import { listHelpRequests, resolveHelpRequest, type HelpRequest } from '../../store/helpRequests';
import { getSiteById } from '../../data/mockSites';
import { formatDateTime } from '../../utils/format';

/**
 * 도움 요청.
 *
 * 시민이 `/help`에서 직접 넣은 건과 담당자가 전화로 받아 대신 넣은 건이 같은 표(help_requests)에
 * 들어온다 — 여기서는 채널만 구분해 보여주고 큐는 하나로 둔다.
 *
 * 상태는 저장소가 가진 두 가지(접수 / 완료)만 쓴다. 중간 단계(확인중·처리중)는 아직 저장할 곳이
 * 없어서 화면에만 만들어 두지 않는다.
 */
const REQUEST_TYPE_LABEL: Record<string, string> = {
  SELF: '직접 방문',
  DELIVERY: '전달 필요',
};

export default function HelpRequestPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const { data, error, isLoading } = useCentralData(() => listHelpRequests(), [refreshKey]);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const selectedId = searchParams.get('id');
  const requests = useMemo(() => data ?? [], [data]);
  const visible = useMemo(
    () => (onlyOpen ? requests.filter((request) => request.status === 'NEW') : requests),
    [requests, onlyOpen],
  );
  const selected = requests.find((request) => request.id === selectedId) ?? null;

  // 오늘 할 일에서 특정 건을 눌러 들어오면, 그 건이 목록에서 걸러지지 않게 한다.
  useEffect(() => {
    if (selectedId && selected && selected.status !== 'NEW') setOnlyOpen(false);
  }, [selectedId, selected]);

  // 빈 상세 패널을 크게 띄우지 않는다 — 목록이 있으면 첫 건을 미리 골라 둔다.
  useEffect(() => {
    if (selected || visible.length === 0) return;
    const next = new URLSearchParams(searchParams);
    next.set('id', visible[0].id);
    setSearchParams(next, { replace: true });
  }, [selected, visible, searchParams, setSearchParams]);

  function select(id: string | null) {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('id', id);
    else next.delete('id');
    setSearchParams(next, { replace: true });
  }

  async function handleResolve(id: string) {
    setResolvingId(id);
    try {
      await resolveHelpRequest(id);
      refresh();
    } finally {
      setResolvingId(null);
    }
  }

  const openCount = requests.filter((request) => request.status === 'NEW').length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOnlyOpen(true)}
          aria-pressed={onlyOpen}
          className={chipClass(onlyOpen)}
        >
          미처리 {openCount}
        </button>
        <button
          type="button"
          onClick={() => setOnlyOpen(false)}
          aria-pressed={!onlyOpen}
          className={chipClass(!onlyOpen)}
        >
          전체 {requests.length}
        </button>

        {/* 전화로 받은 요청을 대신 넣는 유일한 입구. 도움 요청을 다루는 화면에 둔다. */}
        <Link
          to="/admin/help-requests/new"
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-teal-700 transition-colors hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <PhoneIncoming size={13} />
          전화로 받은 요청 대신 입력
          <ArrowRight size={13} />
        </Link>
      </div>

      <CentralDataNotice
        isLoading={isLoading}
        error={error}
        isEmpty={!isLoading && !error && visible.length === 0}
        emptyMessage={onlyOpen ? '미처리 도움 요청이 없습니다.' : '접수된 도움 요청이 없습니다.'}
      />

      {visible.length > 0 && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative overflow-hidden rounded-[16px] border border-[#DCE6F0] bg-white">
            <span className="absolute inset-x-0 top-0 h-[3px] bg-[#15998A]" aria-hidden />
            {/* 연락처는 목록에 두지 않는다 — 처리할 때 보는 값이라 오른쪽 상세에만 있다. */}
            <div className="grid grid-cols-[1fr_0.8fr_1fr_0.9fr_0.7fr] gap-3 border-b border-slate-100 bg-[#F4FAF8] px-4 py-3 text-xs font-medium text-slate-400">
              <span>접수 시각</span>
              <span>지역</span>
              <span>필요한 품목</span>
              <span>요청 방식</span>
              <span>상태</span>
            </div>
            <ul className="divide-y divide-[#EDF1F5]">
              {visible.map((request) => (
                <li key={request.id}>
                  <button
                    type="button"
                    onClick={() => select(request.id)}
                    className={`grid w-full grid-cols-[1fr_0.8fr_1fr_0.9fr_0.7fr] items-center gap-3 px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 ${
                      request.id === selectedId ? 'bg-[#ECF8F5]' : 'hover:bg-[#F1FAF7]'
                    }`}
                  >
                    <span className="text-slate-500">{formatDateTime(request.createdAt)}</span>
                    <span className="font-medium text-slate-800">{request.dong}</span>
                    <span className="text-slate-700">{request.itemCategory}</span>
                    <span className="text-slate-600">
                      {request.requestType ? REQUEST_TYPE_LABEL[request.requestType] : '—'}
                      {request.channel === 'PHONE' && (
                        <span className="ml-1 rounded bg-slate-100 px-1.5 py-px text-[10px] text-slate-500">전화</span>
                      )}
                    </span>
                    <span>
                      <StatusBadge status={request.status === 'NEW' ? '접수' : '완료'} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <HelpRequestDetail
            request={selected}
            resolving={resolvingId === selected?.id}
            onResolve={handleResolve}
            onClose={() => select(null)}
          />
        </div>
      )}
    </div>
  );
}

function HelpRequestDetail({
  request,
  resolving,
  onResolve,
  onClose,
}: {
  request: HelpRequest | null;
  resolving: boolean;
  onResolve: (id: string) => void;
  onClose: () => void;
}) {
  if (!request) {
    return (
      <aside className="h-fit rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
        목록에서 요청을 선택하세요.
      </aside>
    );
  }

  const preferredSite = getSiteById(request.preferredSiteId);

  return (
    <aside className="relative h-fit overflow-hidden rounded-[16px] border border-[#DCE6F0] bg-white">
      <span className="absolute inset-x-0 top-0 h-[3px] bg-[#15998A]" aria-hidden />
      <div className="flex items-start justify-between gap-2 bg-[#EEF9F6] px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {request.dong} · {request.itemCategory}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(request.createdAt)} 접수</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="상세 닫기"
          className="rounded p-1 text-slate-400 hover:bg-white/70 hover:text-slate-600"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-5">
        <dl className="space-y-2 text-sm">
          <DetailRow label="연락처" value={request.phone} />
          <DetailRow
            label="요청 방식"
            value={request.requestType ? REQUEST_TYPE_LABEL[request.requestType] : '선택 안 함'}
          />
          <DetailRow label="접수 경로" value={request.channel === 'PHONE' ? '전화 대리 입력' : '시민 직접 입력'} />
          <DetailRow label="희망 거점" value={preferredSite?.displayName ?? '선택 안 함'} />
          <DetailRow label="상태" value={request.status === 'NEW' ? '접수' : '완료'} />
          {request.resolvedAt && <DetailRow label="처리 시각" value={formatDateTime(request.resolvedAt)} />}
        </dl>

        {request.message && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">&quot;{request.message}&quot;</p>
        )}

        {request.status === 'NEW' ? (
          <button
            type="button"
            onClick={() => onResolve(request.id)}
            disabled={resolving}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <Check size={15} />
            {resolving ? '처리하는 중...' : '처리 완료로 변경'}
          </button>
        ) : (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-center text-sm font-medium text-emerald-700">
            처리 완료된 요청입니다
          </p>
        )}
      </div>
    </aside>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-20 shrink-0 text-slate-400">{label}</dt>
      <dd className="min-w-0 break-words text-slate-700">{value}</dd>
    </div>
  );
}

function chipClass(active: boolean): string {
  return `rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
    active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
  }`;
}
