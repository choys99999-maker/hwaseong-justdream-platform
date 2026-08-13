import { useCallback, useState } from 'react';
import { Check, Gift } from 'lucide-react';
import { useCentralData } from '../../hooks/useCentralData';
import { listDonations, resolveDonation, type Donation } from '../../store/donations';

const VISIBLE_LIMIT = 4;

const METHOD_LABEL: Record<Donation['donationMethod'], string> = {
  SELF_DELIVER: '직접 방문 예정',
  PICKUP_NEEDED: '수거 필요',
};

function formatReceivedAt(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** "오늘 들어온 기부" — 시민 `/donate` 접수를 대시보드 상단(도움 요청 바로 아래)에 큐로 보여준다. */
export default function TodayDonationSection() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, error, isLoading } = useCentralData(() => listDonations(), [refreshKey]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  async function handleResolve(id: string) {
    setResolvingId(id);
    try {
      await resolveDonation(id);
      refresh();
    } finally {
      setResolvingId(null);
    }
  }

  const donations: Donation[] = (data ?? []).filter((d) => d.status === 'NEW');
  const visible = donations.slice(0, VISIBLE_LIMIT);
  const restCount = donations.length - visible.length;

  if (isLoading || error) return null;

  return (
    <section aria-label="오늘 들어온 기부" className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Gift size={16} className="text-amber-700" aria-hidden />
        <h3 className="text-base font-semibold text-slate-900">오늘 들어온 기부</h3>
        {donations.length > 0 && (
          <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[11px] font-semibold text-white">
            {donations.length}건
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-amber-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
          새 기부가 없습니다.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {visible.map((d) => (
            <li key={d.id} className="rounded-lg border border-amber-100 bg-white px-4 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-800">
                      {d.itemName} {d.quantity}개
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-sm text-slate-600">{d.region}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">
                      {METHOD_LABEL[d.donationMethod]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {d.donorContact ? `${d.donorContact} · ` : ''}
                    {formatReceivedAt(d.createdAt)} 접수
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleResolve(d.id)}
                  disabled={resolvingId === d.id}
                  className="flex shrink-0 items-center gap-1 self-center rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
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
