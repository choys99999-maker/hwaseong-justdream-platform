import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, PhoneIncoming, X } from 'lucide-react';
import CentralDataNotice from '../common/CentralDataNotice';
import StatusBadge from '../common/StatusBadge';
import {
  Accent,
  ActionSection,
  AllClear,
  CARD_CLASS,
  HS,
  OverviewSection,
  PageIntro,
  SourceNote,
  SubTabs,
  SummaryStrip,
  Tag,
  VizCard,
} from '../admin/ui';
import { RankBars, SegmentBar } from '../admin/charts';
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
 * 이 화면의 주인공은 그래프가 아니라 **업무 큐**다. 위쪽 요약은 "몇 건 처리하면 되는가"와
 * "어느 지역에서 많이 들어오는가" 두 질문에만 답하고 곧바로 큐로 내려온다.
 *
 * 상태는 저장소가 가진 두 가지(접수 / 완료)만 쓴다. 중간 단계(확인중·처리중)는 아직 저장할 곳이
 * 없어서 화면에만 만들어 두지 않는다.
 */
const REQUEST_TYPE_LABEL: Record<string, string> = {
  SELF: '직접 방문',
  DELIVERY: '전달 필요',
};

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  );
}

/** 큐 한 줄의 시각 표기. 오늘 건은 시각만, 그 전은 날짜까지 보여준다. */
function queueTime(iso: string): string {
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (isToday(iso)) return `오늘 ${time}`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${time}`;
}

export default function HelpRequestPanel({ screenTabs }: { screenTabs?: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const { data, error, isLoading } = useCentralData(() => listHelpRequests(), [refreshKey]);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const selectedId = searchParams.get('id');
  const requests = useMemo(() => data ?? [], [data]);

  /**
   * 큐 정렬 — 오래된 미처리 건이 가장 위다. 시민이 오래 기다린 순서가 곧 처리 순서다.
   * 처리 끝난 건은 아래로 내려가고 최근 처리한 것부터 보인다.
   */
  const ordered = useMemo(
    () =>
      [...requests].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'NEW' ? -1 : 1;
        return a.status === 'NEW'
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt);
      }),
    [requests],
  );

  const visible = useMemo(
    () => (onlyOpen ? ordered.filter((request) => request.status === 'NEW') : ordered),
    [ordered, onlyOpen],
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
  const doneCount = requests.length - openCount;
  const todayCount = requests.filter((request) => isToday(request.createdAt)).length;

  /** 요청이 몰리는 읍면동. 어디에 도움이 필요한지 곧바로 읽힌다. */
  const byDong = useMemo(() => {
    const counts = new Map<string, number>();
    for (const request of requests) {
      if (request.status !== 'NEW') continue;
      counts.set(request.dong, (counts.get(request.dong) ?? 0) + 1);
    }
    return Array.from(counts, ([dong, count]) => ({ dong, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [requests]);

  const phoneLink = (
    <Link
      to="/admin/help-requests/new"
      className="ad-lift inline-flex items-center gap-1.5 rounded-xl border border-[#DFE7EF] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#004696] hover:border-[#C9DCEF] hover:bg-[#F7FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
    >
      <PhoneIncoming size={15} />
      전화로 받은 요청 대신 입력
      <ArrowRight size={14} />
    </Link>
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <PageIntro
        eyebrow="시민 도움 요청"
        headline={
          openCount > 0 ? (
            <>
              현재 처리해야 할 요청이 <Accent>{openCount}건</Accent> 있습니다
            </>
          ) : requests.length > 0 ? (
            <>접수된 요청을 모두 처리했습니다</>
          ) : (
            <>아직 접수된 도움 요청이 없습니다</>
          )
        }
        description="시민이 모바일에서 넣은 요청과 전화로 받아 대신 넣은 요청이 함께 들어옵니다. 오래 기다린 건이 맨 위에 옵니다."
        actions={phoneLink}
      />

      {screenTabs}

      <CentralDataNotice
        isLoading={isLoading}
        error={error}
        isEmpty={!isLoading && !error && requests.length === 0}
        emptyMessage="접수된 도움 요청이 없습니다."
      />

      {requests.length > 0 && (
        <>
          {/* ── OVERVIEW — 얼마나 밀렸는가 · 어디에서 오는가 ── */}
          <OverviewSection label="도움 요청 처리 현황">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <VizCard title="처리 현황" question="지금 몇 건이 남아 있는가?" delay={40}>
                <SummaryStrip
                  figures={[
                    { label: '오늘 접수', value: todayCount, unit: '건', tone: 'blue' },
                    {
                      label: '미처리',
                      value: openCount,
                      unit: '건',
                      tone: 'orange',
                      active: onlyOpen,
                      onClick: () => setOnlyOpen(true),
                    },
                    {
                      label: '처리 완료',
                      value: doneCount,
                      unit: '건',
                      tone: 'success',
                      active: !onlyOpen,
                      onClick: () => setOnlyOpen(false),
                    },
                  ]}
                />
                <div className="mt-5">
                  <SegmentBar
                    activeKey={onlyOpen ? 'open' : null}
                    segments={[
                      {
                        key: 'open',
                        label: '미처리',
                        value: openCount,
                        color: HS.orange,
                        onSelect: () => setOnlyOpen(true),
                      },
                      {
                        key: 'done',
                        label: '처리 완료',
                        value: doneCount,
                        color: HS.success,
                        onSelect: () => setOnlyOpen(false),
                      },
                    ]}
                  />
                </div>
              </VizCard>

              <VizCard title="미처리 요청이 많은 지역" question="어디에서 도움을 찾고 있는가?" delay={90}>
                <RankBars
                  items={byDong.map((item) => ({
                    key: item.dong,
                    label: item.dong,
                    value: item.count,
                    valueText: `${item.count}건`,
                  }))}
                  emptyMessage="미처리 요청이 없습니다."
                />
              </VizCard>
            </div>
          </OverviewSection>

          {/* ── ACTION — 이 화면의 주인공. 큐와 상세가 나란히 선다 ── */}
          <ActionSection
            title="지금 처리할 요청"
            aside={
              <SubTabs
                label="요청 범위"
                value={onlyOpen ? 'open' : 'all'}
                onChange={(key) => setOnlyOpen(key === 'open')}
                tabs={[
                  { key: 'open', label: '미처리', count: openCount },
                  { key: 'all', label: '전체', count: requests.length },
                ]}
              />
            }
          >
            {visible.length === 0 ? (
              <AllClear message="미처리 도움 요청이 없습니다." />
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <ul className="space-y-2">
                  {visible.map((request, i) => (
                    <li key={request.id}>
                      <button
                        type="button"
                        onClick={() => select(request.id)}
                        style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                        className={`ad-rise ad-lift flex min-h-[68px] w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] ${
                          request.id === selectedId
                            ? 'border-[#004696] bg-[#F3F8FD]'
                            : 'border-[#E7EEF6] bg-white hover:border-[#C9DCEF] hover:shadow-[0_6px_18px_rgba(30,64,100,0.07)]'
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-[14.5px] font-semibold text-[#182230]">
                              {request.dong} · {request.itemCategory}
                            </span>
                            {request.channel === 'PHONE' && <Tag tone="neutral">전화 접수</Tag>}
                          </span>
                          <span className="mt-1 block text-[12.5px] text-[#667085]">
                            {queueTime(request.createdAt)}
                            {request.requestType && ` · ${REQUEST_TYPE_LABEL[request.requestType]}`}
                          </span>
                        </span>
                        <StatusBadge status={request.status === 'NEW' ? '접수' : '완료'} />
                        <span className="shrink-0 text-[12.5px] font-semibold text-[#004696]">
                          {request.status === 'NEW' ? '처리하기' : '보기'} <span aria-hidden>→</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                <HelpRequestDetail
                  request={selected}
                  resolving={resolvingId === selected?.id}
                  onResolve={handleResolve}
                  onClose={() => select(null)}
                />
              </div>
            )}
          </ActionSection>
        </>
      )}

      <SourceNote>
        출처: 시민 앱 도움 요청 · 전화 대리 입력(help_requests). 상태는 저장소가 가진 접수·완료 두 가지입니다.
      </SourceNote>
    </div>
  );
}

/**
 * 요청 상세.
 *
 * 위에서부터 "누가·무엇을" → "어떻게 연락하고 어디로 보낼지" → "완료 처리" 순이다.
 * 가장 아래 버튼 하나가 이 패널에서 할 수 있는 유일한 저장 동작이다.
 */
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
      <aside className="h-fit rounded-xl border border-dashed border-[#DFE7EF] bg-white px-4 py-3 text-[13px] text-[#98A2B3]">
        목록에서 요청을 선택하세요.
      </aside>
    );
  }

  const preferredSite = getSiteById(request.preferredSiteId);

  return (
    // 큐가 길어도 처리 버튼이 화면 밖으로 밀려나지 않게 상세는 따라 붙는다.
    <aside className={`h-fit xl:sticky xl:top-0 ${CARD_CLASS} p-5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11.5px] font-semibold tracking-wide text-[#004696]">도움 요청</p>
          <h3 className="mt-0.5 text-[19px] font-bold leading-tight text-[#182230]">
            {request.dong} · {request.itemCategory}
          </h3>
          <p className="mt-1 text-[12px] text-[#8A96A8]">{formatDateTime(request.createdAt)} 접수</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="상세 닫기"
          className="rounded p-1 text-[#98A2B3] hover:bg-[#F3F6FA] hover:text-[#667085]"
        >
          <X size={16} />
        </button>
      </div>

      {request.message && (
        <p className="mt-3.5 rounded-xl bg-[#F3F8FD] px-3.5 py-3 text-[13px] leading-relaxed text-[#4C5A6E]">
          “{request.message}”
        </p>
      )}

      <dl className="mt-4 space-y-2.5 border-t border-[#EFF3F8] pt-4 text-[13px]">
        <DetailRow label="연락처" value={request.phone} strong />
        <DetailRow
          label="요청 방식"
          value={request.requestType ? REQUEST_TYPE_LABEL[request.requestType] : '선택 안 함'}
        />
        <DetailRow label="접수 경로" value={request.channel === 'PHONE' ? '전화 대리 입력' : '시민 직접 입력'} />
        <DetailRow label="희망 거점" value={preferredSite?.displayName ?? '선택 안 함'} />
        <DetailRow label="상태" value={request.status === 'NEW' ? '접수' : '완료'} />
        {request.resolvedAt && <DetailRow label="처리 시각" value={formatDateTime(request.resolvedAt)} />}
      </dl>

      {request.status === 'NEW' ? (
        <button
          type="button"
          onClick={() => onResolve(request.id)}
          disabled={resolving}
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#DC6E2D] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#BC5A1F] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC6E2D] focus-visible:ring-offset-2"
        >
          <Check size={16} />
          {resolving ? '처리하는 중...' : '처리 완료로 변경'}
        </button>
      ) : (
        <p className="mt-5 rounded-xl bg-[#EFF9F6] px-3 py-3 text-center text-[13.5px] font-semibold text-[#0F7A52]">
          처리 완료된 요청입니다
        </p>
      )}
    </aside>
  );
}

function DetailRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex gap-4">
      <dt className="w-20 shrink-0 text-[#8A96A8]">{label}</dt>
      <dd
        className={`min-w-0 break-words ${strong ? 'font-semibold text-[#182230]' : 'text-[#4C5A6E]'}`}
      >
        {value}
      </dd>
    </div>
  );
}
