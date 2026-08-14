import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import TodayQueue, { type TodayItem } from './TodayQueue';
import QuickStatusForm, { availabilityLabel } from '../sites/QuickStatusForm';
import SiteStatusBadge from '../common/SiteStatusBadge';
import { useCentralData } from '../../hooks/useCentralData';
import { useAdminRole } from '../../hooks/useAdminRole';
import { listHelpRequests } from '../../store/helpRequests';
import { listDonations } from '../../store/donations';
import { listSiteQuickStatus } from '../../store/citizenSites';
import { getSiteById, mockSites, siteAreaOf } from '../../data/mockSites';
import { getActionItemsBySite } from '../../data/actionItems';
import { REGION_NAMES } from '../../data/regionMeta';
import { buildSiteRows, updateGapLabel } from '../../utils/siteOperations';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * 현장 담당자 첫 화면.
 *
 * 화성시 전체 KPI를 앞에 두지 않는다. 답해야 할 질문은 둘뿐이다 —
 * "우리 거점 상태를 지금 입력해야 하나", "우리한테 온 건이 뭐가 있나".
 */
export default function FieldToday() {
  const { mySiteId, setMySiteId } = useAdminRole();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, error, isLoading } = useCentralData(
    () =>
      Promise.all([listHelpRequests(), listDonations(), listSiteQuickStatus()]).then(
        ([helpRequests, donations, quickStatus]) => ({ helpRequests, donations, quickStatus }),
      ),
    [refreshKey],
  );

  const sortedSites = useMemo(
    () => [...mockSites].sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko')),
    [],
  );

  const site = getSiteById(mySiteId);
  const myArea = mySiteId ? siteAreaOf(mySiteId) : null;

  // 현장 입력을 아직 못 읽은 상태와 "정말 입력이 없는" 상태는 다르게 보여준다.
  const fieldStatusUnknown = data === null;
  const myRow = useMemo(() => {
    if (!mySiteId) return null;
    return buildSiteRows(data?.quickStatus ?? null).find((row) => row.site.id === mySiteId) ?? null;
  }, [data, mySiteId]);

  const items = useMemo<TodayItem[]>(() => {
    if (!site) return [];

    // 우리 읍면동에서 올라온 도움 요청 + 우리 거점을 콕 집은 요청
    const help: TodayItem[] = (data?.helpRequests ?? [])
      .filter((request) => request.status === 'NEW')
      .filter((request) => request.dong === myArea || request.preferredSiteId === site.id)
      .map((request) => ({
        id: `help-${request.id}`,
        kind: 'help' as const,
        place: request.dong,
        what: `${request.itemCategory} 도움 요청${request.requestType === 'DELIVERY' ? ' (전달 필요)' : ''}`,
        when: `${formatTime(request.createdAt)} 접수`,
        to: `/admin/intake?tab=help&id=${request.id}`,
      }));

    // 우리 거점으로 오기로 한 기부 + 우리 동네에서 올라온 기부
    const donation: TodayItem[] = (data?.donations ?? [])
      .filter((row) => row.status === 'NEW')
      .filter((row) => row.targetSiteId === site.id || (!row.targetSiteId && row.region === myArea))
      .map((row) => ({
        id: `donation-${row.id}`,
        kind: 'donation' as const,
        place: row.region,
        what: `${row.itemName} ${row.quantity}개${row.donationMethod === 'PICKUP_NEEDED' ? ' (수거 필요)' : ''}`,
        when: `${formatTime(row.createdAt)} 접수`,
        to: `/admin/intake?tab=donation&id=${row.id}`,
      }));

    const supply: TodayItem[] = getActionItemsBySite(site.id).map((action) => ({
      id: action.id,
      kind: 'supply' as const,
      place: action.siteName,
      what: action.summary,
      when: action.suggestion,
      to: `/admin/sites/${site.id}`,
    }));

    return [...help, ...donation, ...supply];
  }, [data, site, myArea]);

  // 담당 거점을 아직 고르지 않았다 — 이 화면은 그것부터 물어야 한다.
  if (!site) {
    return (
      <section className="mx-auto w-full max-w-[560px] rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900">담당 거점을 선택해 주세요</h2>
        <p className="mt-1 text-sm text-slate-500">
          선택한 거점을 기준으로 오늘 입력할 것과 처리할 건만 보여 드립니다.
        </p>
        <label htmlFor="my-site" className="mt-4 block text-sm font-semibold text-slate-700">
          우리 거점
        </label>
        <select
          id="my-site"
          defaultValue=""
          onChange={(event) => event.target.value && setMySiteId(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="" disabled>
            거점을 선택하세요
          </option>
          {sortedSites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName} · {REGION_NAMES[s.district]}
            </option>
          ))}
        </select>
      </section>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      {/* ── 우리 거점 ────────────────────────────────────────── */}
      <section aria-label="우리 거점" className="order-2 space-y-3 xl:order-1">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">{site.displayName}</h2>
                <SiteStatusBadge status={site.status} />
              </div>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                <MapPin size={12} className="shrink-0" />
                {REGION_NAMES[site.district]} · {myArea ?? '—'} · {site.facilityType}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMySiteId('')}
              className="shrink-0 text-xs font-medium text-slate-400 underline-offset-2 hover:text-teal-700 hover:underline"
            >
              거점 변경
            </button>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">시민 화면에 보이는 상태</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-800">
                {fieldStatusUnknown
                  ? '확인 중'
                  : myRow?.quickStatus
                    ? availabilityLabel(myRow.quickStatus.availability)
                    : '입력 없음'}
              </dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">마지막 갱신</dt>
              <dd
                className={`mt-1 text-sm font-semibold ${
                  !fieldStatusUnknown && myRow?.needsUpdate ? 'text-amber-700' : 'text-slate-800'
                }`}
              >
                {fieldStatusUnknown ? '확인 중' : myRow ? updateGapLabel(myRow) : '—'}
              </dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">주요 품목</dt>
              <dd className="mt-1 truncate text-sm font-semibold text-slate-800">
                {myRow?.quickStatus?.focusItem ?? site.focusItem}
              </dd>
            </div>
          </dl>

          <Link
            to={`/admin/sites/${site.id}`}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"
          >
            거점 상세 열기
            <ArrowRight size={13} />
          </Link>
        </div>

        {/* ── 오늘 처리 ──────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">오늘 처리</h2>
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">
              {items.length}건
            </span>
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
              시민 접수 큐를 불러오지 못했습니다: {error}
            </p>
          )}

          <div className="mt-3">
            {isLoading ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                불러오는 중...
              </p>
            ) : (
              <TodayQueue
                items={items}
                emptyMessage={`${site.displayName}으로 온 도움 요청·기부가 없습니다.`}
              />
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            우리 읍면동({myArea ?? '—'})에서 올라온 건과 우리 거점을 지정한 건만 모았습니다.
          </p>
        </div>
      </section>

      {/* ── 빠른 현황 입력 — 현장에서 가장 자주 쓰는 동작이라 항상 펼쳐 둔다 ── */}
      <section aria-label="빠른 현황 입력" className="order-1 xl:order-2">
        <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4">
          <h2 className="text-base font-semibold text-slate-900">빠른 현황 입력</h2>
          <p className="mt-1 text-xs text-slate-500">
            저장하면 시민 화면의 &quot;지금 상태&quot;가 바로 바뀝니다.
          </p>
          <div className="mt-3 rounded-lg bg-white p-4">
            <QuickStatusForm fixedSiteId={site.id} onSaved={() => setRefreshKey((k) => k + 1)} />
          </div>
        </div>
      </section>
    </div>
  );
}
