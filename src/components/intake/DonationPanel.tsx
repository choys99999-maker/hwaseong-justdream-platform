import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, ImageOff, X } from 'lucide-react';
import CentralDataNotice from '../common/CentralDataNotice';
import StatusBadge from '../common/StatusBadge';
import { useCentralData } from '../../hooks/useCentralData';
import {
  getDonationPhotoUrl,
  listDonations,
  resolveDonation,
  type Donation,
} from '../../store/donations';
import { getSiteById } from '../../data/mockSites';
import { formatDateTime } from '../../utils/format';

const METHOD_LABEL: Record<Donation['donationMethod'], string> = {
  SELF_DELIVER: '직접 방문',
  PICKUP_NEEDED: '수거 필요',
};

/**
 * 물품 기부.
 *
 * 표시하는 품목·수량은 AI 인식 결과가 아니라 시민이 마지막에 확인·수정해 저장한 값이다
 * (`donations.item_name`/`quantity`). 관리자 화면은 그 값만 기준 데이터로 쓴다.
 *
 * 상태는 저장소가 가진 두 가지(접수 / 수령 완료)만 쓴다.
 */
export default function DonationPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const { data, error, isLoading } = useCentralData(() => listDonations(), [refreshKey]);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const selectedId = searchParams.get('id');
  const donations = useMemo(() => data ?? [], [data]);
  const visible = useMemo(
    () => (onlyOpen ? donations.filter((row) => row.status === 'NEW') : donations),
    [donations, onlyOpen],
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOnlyOpen(true)} aria-pressed={onlyOpen} className={chipClass(onlyOpen)}>
          미처리 {openCount}
        </button>
        <button
          type="button"
          onClick={() => setOnlyOpen(false)}
          aria-pressed={!onlyOpen}
          className={chipClass(!onlyOpen)}
        >
          전체 {donations.length}
        </button>
      </div>

      <CentralDataNotice
        isLoading={isLoading}
        error={error}
        isEmpty={!isLoading && !error && visible.length === 0}
        emptyMessage={onlyOpen ? '미처리 기부가 없습니다.' : '접수된 기부가 없습니다.'}
      />

      {visible.length > 0 && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="grid grid-cols-[0.9fr_52px_1.2fr_0.8fr_1fr_1fr_0.7fr] items-center gap-3 border-b border-slate-100 px-4 py-3 text-xs font-medium text-slate-400">
              <span>접수 시각</span>
              <span>사진</span>
              <span>품목 · 수량</span>
              <span>전달 방식</span>
              <span>대상 거점</span>
              <span>연락처</span>
              <span>상태</span>
            </div>
            <ul className="divide-y divide-slate-50">
              {visible.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => select(row.id)}
                    className={`grid w-full grid-cols-[0.9fr_52px_1.2fr_0.8fr_1fr_1fr_0.7fr] items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 ${
                      row.id === selectedId ? 'bg-amber-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-slate-500">{formatDateTime(row.createdAt)}</span>
                    <DonationPhoto path={row.imagePath} size="thumb" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-800">{row.itemName}</span>
                      <span className="block text-xs text-slate-400">{row.quantity}개 · {row.region}</span>
                    </span>
                    <span className="text-slate-600">{METHOD_LABEL[row.donationMethod]}</span>
                    <span className="truncate text-slate-600">
                      {getSiteById(row.targetSiteId)?.displayName ?? '미지정'}
                    </span>
                    <span className="truncate text-slate-600">{row.donorContact ?? '—'}</span>
                    <span>
                      <StatusBadge status={row.status === 'NEW' ? '접수' : '수령 완료'} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <DonationDetail
            donation={selected}
            resolving={resolvingId === selected?.id}
            onResolve={handleResolve}
            onClose={() => select(null)}
          />
        </div>
      )}
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

  const boxClass =
    size === 'thumb'
      ? 'h-10 w-10 rounded-md object-cover'
      : 'aspect-square w-full rounded-lg object-cover';
  const placeholderClass =
    size === 'thumb'
      ? 'flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-300'
      : 'flex aspect-square w-full items-center justify-center rounded-lg bg-slate-100 text-slate-300';

  if (failed) {
    return (
      <span className={placeholderClass} title="사진을 불러오지 못했습니다">
        <ImageOff size={size === 'thumb' ? 14 : 24} />
      </span>
    );
  }
  if (!url) return <span className={placeholderClass} aria-hidden />;
  return <img src={url} alt="기부 물품 사진" className={boxClass} />;
}

function DonationDetail({
  donation,
  resolving,
  onResolve,
  onClose,
}: {
  donation: Donation | null;
  resolving: boolean;
  onResolve: (id: string) => void;
  onClose: () => void;
}) {
  if (!donation) {
    return (
      <aside className="h-fit rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
        목록에서 기부를 선택하세요.
      </aside>
    );
  }

  return (
    <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {donation.itemName} {donation.quantity}개
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(donation.createdAt)} 접수</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="상세 닫기"
          className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-3">
        <DonationPhoto path={donation.imagePath} size="large" />
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <DetailRow label="지역" value={donation.region} />
        <DetailRow label="전달 방식" value={METHOD_LABEL[donation.donationMethod]} />
        <DetailRow label="대상 거점" value={getSiteById(donation.targetSiteId)?.displayName ?? '미지정'} />
        <DetailRow label="연락처" value={donation.donorContact ?? '남기지 않음'} />
        <DetailRow label="상태" value={donation.status === 'NEW' ? '접수' : '수령 완료'} />
        {donation.resolvedAt && <DetailRow label="처리 시각" value={formatDateTime(donation.resolvedAt)} />}
      </dl>

      <p className="mt-3 text-[11px] text-slate-400">
        품목·수량은 기부자가 사진 인식 결과를 확인·수정해 저장한 값입니다.
      </p>

      {donation.status === 'NEW' ? (
        <button
          type="button"
          onClick={() => onResolve(donation.id)}
          disabled={resolving}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <Check size={15} />
          {resolving ? '처리하는 중...' : '수령 완료로 변경'}
        </button>
      ) : (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2.5 text-center text-sm font-medium text-emerald-700">
          수령 완료된 기부입니다
        </p>
      )}
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
    active ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
  }`;
}
