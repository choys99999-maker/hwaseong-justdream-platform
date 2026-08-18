import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, ImageOff, X } from 'lucide-react';
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
import {
  getDonationPhotoUrl,
  listDonations,
  resolveDonation,
  type Donation,
} from '../../store/donations';
import { listInventoryStatus, type InventoryStatus as InventoryRow } from '../../store/analytics';
import { getSiteById } from '../../data/mockSites';
import { formatDateTime } from '../../utils/format';

const METHOD_LABEL: Record<Donation['donationMethod'], string> = {
  SELF_DELIVER: '직접 방문',
  PICKUP_NEEDED: '수거 필요',
};

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  );
}

function queueTime(iso: string): string {
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (isToday(iso)) return `오늘 ${time}`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${time}`;
}

/**
 * 물품 기부.
 *
 * 목적은 "들어온 기부를 빠르게 확인하고 필요한 거점과 연결하는 것"이다. 그래서 목록에서는
 * 사진을 작게(48px) 두어 무엇이·어디서·어디로 가는지가 먼저 읽히게 하고, 사진은 오른쪽
 * 상세에서만 크게 보여준다.
 *
 * 표시하는 품목·수량은 AI 인식 결과가 아니라 시민이 마지막에 확인·수정해 저장한 값이다
 * (`donations.item_name`/`quantity`). 관리자 화면은 그 값만 기준 데이터로 쓴다.
 *
 * 상태는 저장소가 가진 두 가지(접수 / 수령 완료)만 쓴다.
 */
export default function DonationPanel({ screenTabs }: { screenTabs?: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const { data, error, isLoading } = useCentralData(() => listDonations(), [refreshKey]);
  // 추천 연결 거점을 실제 재고에서 뽑기 위해 함께 읽는다. 실패해도 나머지 화면은 그대로 그린다.
  const { data: inventory } = useCentralData(() => listInventoryStatus(), []);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const selectedId = searchParams.get('id');
  const donations = useMemo(() => data ?? [], [data]);

  /** 오래 기다린 미처리 건이 맨 위. 수령 완료 건은 최근 처리 순으로 아래에 쌓인다. */
  const ordered = useMemo(
    () =>
      [...donations].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'NEW' ? -1 : 1;
        return a.status === 'NEW'
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt);
      }),
    [donations],
  );

  const visible = useMemo(
    () => (onlyOpen ? ordered.filter((row) => row.status === 'NEW') : ordered),
    [ordered, onlyOpen],
  );
  const selected = donations.find((row) => row.id === selectedId) ?? null;

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
      await resolveDonation(id);
      refresh();
    } finally {
      setResolvingId(null);
    }
  }

  const openCount = donations.filter((row) => row.status === 'NEW').length;
  const doneCount = donations.length - openCount;
  const todayCount = donations.filter((row) => isToday(row.createdAt)).length;

  /** 지금 들어오고 있는 품목. 수령 대기 건만 센다 — 이미 처리한 건은 판단 대상이 아니다. */
  const byItem = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of donations) {
      if (row.status !== 'NEW') continue;
      counts.set(row.itemName, (counts.get(row.itemName) ?? 0) + row.quantity);
    }
    return Array.from(counts, ([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 4);
  }, [donations]);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <PageIntro
        eyebrow="물품 기부"
        headline={
          openCount > 0 ? (
            <>
              수령을 확인할 기부가 <Accent>{openCount}건</Accent> 있습니다
            </>
          ) : donations.length > 0 ? (
            <>들어온 기부를 모두 처리했습니다</>
          ) : (
            <>아직 접수된 기부가 없습니다</>
          )
        }
        description="시민이 사진과 함께 남긴 물품 기부입니다. 품목·수량은 기부자가 최종 확인한 값입니다."
      />

      {screenTabs}

      <CentralDataNotice
        isLoading={isLoading}
        error={error}
        isEmpty={!isLoading && !error && donations.length === 0}
        emptyMessage="접수된 기부가 없습니다."
      />

      {donations.length > 0 && (
        <>
          {/* ── OVERVIEW — 얼마나 들어왔는가 · 무엇이 들어오는가 ── */}
          <OverviewSection label="기부 접수 현황">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <VizCard title="접수 현황" question="지금 몇 건을 확인해야 하는가?" delay={40}>
                <SummaryStrip
                  figures={[
                    { label: '오늘 기부', value: todayCount, unit: '건', tone: 'blue' },
                    {
                      label: '수령 대기',
                      value: openCount,
                      unit: '건',
                      tone: 'orange',
                      active: onlyOpen,
                      onClick: () => setOnlyOpen(true),
                    },
                    {
                      label: '수령 완료',
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
                        label: '수령 대기',
                        value: openCount,
                        color: HS.orange,
                        onSelect: () => setOnlyOpen(true),
                      },
                      {
                        key: 'done',
                        label: '수령 완료',
                        value: doneCount,
                        color: HS.success,
                        onSelect: () => setOnlyOpen(false),
                      },
                    ]}
                  />
                </div>
              </VizCard>

              <VizCard title="들어온 품목" question="지금 무엇이 모이고 있는가?" delay={90}>
                <RankBars
                  accent={HS.blue}
                  items={byItem.map((item) => ({
                    key: item.name,
                    label: item.name,
                    value: item.quantity,
                    valueText: `${item.quantity}개`,
                  }))}
                  emptyMessage="수령 대기 중인 기부가 없습니다."
                />
              </VizCard>
            </div>
          </OverviewSection>

          {/* ── ACTION — 확인할 기부 큐와 상세 ── */}
          <ActionSection
            title="지금 확인할 기부"
            aside={
              <SubTabs
                label="기부 범위"
                value={onlyOpen ? 'open' : 'all'}
                onChange={(key) => setOnlyOpen(key === 'open')}
                tabs={[
                  { key: 'open', label: '수령 대기', count: openCount },
                  { key: 'all', label: '전체', count: donations.length },
                ]}
              />
            }
          >
            {visible.length === 0 ? (
              <AllClear message="수령을 확인할 기부가 없습니다." />
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <ul className="space-y-2">
                  {visible.map((row, i) => {
                    const target = getSiteById(row.targetSiteId);
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => select(row.id)}
                          style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                          className={`ad-rise ad-lift flex min-h-[68px] w-full items-center gap-3.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] ${
                            row.id === selectedId
                              ? 'border-[#004696] bg-[#F3F8FD]'
                              : 'border-[#E7EEF6] bg-white hover:border-[#C9DCEF] hover:shadow-[0_6px_18px_rgba(30,64,100,0.07)]'
                          }`}
                        >
                          <DonationPhoto path={row.imagePath} size="thumb" />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-[14.5px] font-semibold text-[#182230]">
                                {row.itemName} {row.quantity}개
                              </span>
                              <Tag tone={row.donationMethod === 'PICKUP_NEEDED' ? 'warning' : 'neutral'}>
                                {METHOD_LABEL[row.donationMethod]}
                              </Tag>
                            </span>
                            <span className="mt-1 block truncate text-[12.5px] text-[#667085]">
                              {row.region} · {queueTime(row.createdAt)} · 대상 거점{' '}
                              {target ? target.displayName : '미지정'}
                            </span>
                          </span>
                          <StatusBadge status={row.status === 'NEW' ? '접수' : '수령 완료'} />
                          <span className="shrink-0 text-[12.5px] font-semibold text-[#004696]">
                            {row.status === 'NEW' ? '확인하기' : '보기'} <span aria-hidden>→</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <DonationDetail
                  donation={selected}
                  inventory={inventory}
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
        출처: 시민 앱 물품 기부(donations) · 추천 연결 거점은 중앙 재고(v_inventory_status)에서 같은 품목의
        보유량이 적은 곳을 뽑은 것입니다.
      </SourceNote>
    </div>
  );
}

/** 기부 사진. 버킷이 비공개라 볼 때마다 서명 URL을 새로 받는다. */
function DonationPhoto({ path, size }: { path: string; size: 'thumb' | 'large' }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    getDonationPhotoUrl(path)
      .then((signed) => {
        if (cancelled) return;
        if (signed) setUrl(signed);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  // 목록에서는 48px. 사진은 판단 근거가 아니라 확인용이라 크게 두지 않는다.
  const boxClass =
    size === 'thumb'
      ? 'h-12 w-12 shrink-0 rounded-lg object-cover'
      : 'aspect-square w-full rounded-xl object-cover';
  const placeholderClass =
    size === 'thumb'
      ? 'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#EDF2F8] text-[#B6C2D2]'
      : 'flex aspect-square w-full items-center justify-center rounded-xl bg-[#EDF2F8] text-[#B6C2D2]';

  if (failed) {
    return (
      <span className={placeholderClass} title="사진을 불러오지 못했습니다">
        <ImageOff size={size === 'thumb' ? 16 : 28} />
      </span>
    );
  }
  if (!url) return <span className={placeholderClass} aria-hidden />;
  return <img src={url} alt="기부 물품 사진" className={boxClass} />;
}

/**
 * 이 기부 품목이 모자란 거점.
 *
 * 값을 지어내지 않는다 — 중앙 재고에 실제로 올라온 같은(또는 이름이 겹치는) 품목 중
 * 남은 수량이 적은 순으로 두 곳만 보여준다. 연결 저장 기능은 아직 저장소에 없으므로
 * 만들지 않고, 해당 거점의 재고 화면으로 보내는 것까지만 한다.
 */
function suggestSites(donation: Donation, inventory: InventoryRow[] | null) {
  if (!inventory) return [];
  const name = donation.itemName.trim();
  if (!name) return [];
  return inventory
    .filter((row) => row.itemName.includes(name) || name.includes(row.itemName))
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
    .slice(0, 2);
}

function DonationDetail({
  donation,
  inventory,
  resolving,
  onResolve,
  onClose,
}: {
  donation: Donation | null;
  inventory: InventoryRow[] | null;
  resolving: boolean;
  onResolve: (id: string) => void;
  onClose: () => void;
}) {
  if (!donation) {
    return (
      <aside className="h-fit rounded-xl border border-dashed border-[#DFE7EF] bg-white px-4 py-3 text-[13px] text-[#98A2B3]">
        목록에서 기부를 선택하세요.
      </aside>
    );
  }

  const target = getSiteById(donation.targetSiteId);
  const suggestions = suggestSites(donation, inventory);

  return (
    // 큐가 길어도 처리 버튼이 화면 밖으로 밀려나지 않게 상세는 따라 붙는다.
    <aside className={`h-fit xl:sticky xl:top-0 ${CARD_CLASS} p-5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11.5px] font-semibold tracking-wide text-[#004696]">물품 기부</p>
          <h3 className="mt-0.5 text-[19px] font-bold leading-tight text-[#182230]">
            {donation.itemName} {donation.quantity}개
          </h3>
          <p className="mt-1 text-[12px] text-[#8A96A8]">{formatDateTime(donation.createdAt)} 접수</p>
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

      <div className="mt-3.5">
        <DonationPhoto path={donation.imagePath} size="large" />
      </div>

      <dl className="mt-4 space-y-2.5 border-t border-[#EFF3F8] pt-4 text-[13px]">
        <DetailRow label="지역" value={donation.region} strong />
        <DetailRow label="전달 방식" value={METHOD_LABEL[donation.donationMethod]} />
        <DetailRow label="대상 거점" value={target?.displayName ?? '미지정'} />
        <DetailRow label="연락처" value={donation.donorContact ?? '남기지 않음'} />
        <DetailRow label="상태" value={donation.status === 'NEW' ? '접수' : '수령 완료'} />
        {donation.resolvedAt && <DetailRow label="처리 시각" value={formatDateTime(donation.resolvedAt)} />}
      </dl>

      {suggestions.length > 0 && (
        <section className="mt-4 rounded-xl bg-[#F3F8FD] p-3.5">
          <h4 className="text-[12.5px] font-semibold text-[#004696]">이 품목이 부족한 거점</h4>
          <ul className="mt-2 space-y-1.5">
            {suggestions.map((row) => (
              <li key={`${row.organizationId}-${row.itemName}`}>
                <Link
                  to={`/admin/sites/inventory?q=${encodeURIComponent(row.organizationName)}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-[13px] transition-colors hover:bg-[#EAF3FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
                >
                  <span className="min-w-0 truncate font-medium text-[#182230]">{row.organizationName}</span>
                  <span className="shrink-0 text-[12px] text-[#667085]">
                    {row.itemName} <strong className="font-bold text-[#DC6E2D]">{row.stock ?? '—'}개</strong>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-[#98A2B3]">
        품목·수량은 기부자가 사진 인식 결과를 확인·수정해 저장한 값입니다.
      </p>

      {donation.status === 'NEW' ? (
        <button
          type="button"
          onClick={() => onResolve(donation.id)}
          disabled={resolving}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#DC6E2D] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#BC5A1F] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC6E2D] focus-visible:ring-offset-2"
        >
          <Check size={16} />
          {resolving ? '처리하는 중...' : '수령 완료로 변경'}
        </button>
      ) : (
        <p className="mt-3 rounded-xl bg-[#EFF9F6] px-3 py-3 text-center text-[13.5px] font-semibold text-[#0F7A52]">
          수령 완료된 기부입니다
        </p>
      )}
    </aside>
  );
}

function DetailRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex gap-4">
      <dt className="w-20 shrink-0 text-[#8A96A8]">{label}</dt>
      <dd className={`min-w-0 break-words ${strong ? 'font-semibold text-[#182230]' : 'text-[#4C5A6E]'}`}>
        {value}
      </dd>
    </div>
  );
}
