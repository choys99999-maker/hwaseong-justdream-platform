import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Phone } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import SiteStatusBadge from '../../components/common/SiteStatusBadge';
import CentralDataNotice from '../../components/common/CentralDataNotice';
import QuickStatusForm, { availabilityLabel } from '../../components/sites/QuickStatusForm';
import { useCentralData } from '../../hooks/useCentralData';
import { listSiteQuickStatus } from '../../store/citizenSites';
import { listInventoryStatus, type InventoryStatus as InventoryRow } from '../../store/analytics';
import { listSubmissions, type RemoteSubmissionSummary } from '../../store/remote';
import { getSiteById, siteAreaOf } from '../../data/mockSites';
import { getActionItemsBySite } from '../../data/actionItems';
import { REGION_NAMES } from '../../data/regionMeta';
import { buildSiteRows, updateGapLabel } from '../../utils/siteOperations';
import { inventoryStatusOf } from '../../utils/inventoryStatus';
import { formatUpdatedAt } from '../../utils/submission';
import { formatDate, formatNumber, formatStock } from '../../utils/format';

type TabKey = 'status' | 'quick' | 'inventory' | 'history';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'status', label: '현황' },
  { key: 'quick', label: '빠른 입력' },
  { key: 'inventory', label: '재고' },
  { key: 'history', label: '입력 이력' },
];

function resolveTab(value: string | null): TabKey {
  return TABS.some((tab) => tab.key === value) ? (value as TabKey) : 'status';
}

/**
 * 거점 상세.
 *
 * 거점 하나에 대해 담당자가 하는 일 전부가 여기 안에 있다 —
 * 지금 상태 확인(현황) → 상태 갱신(빠른 입력) → 물품 확인(재고) → 무엇이 들어왔는지(입력 이력).
 * 재고·입력 이력은 이 거점이 속한 읍면동이 중앙 저장소에 올린 실제 자료를 쓴다.
 */
export default function SiteDetailPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveTab(searchParams.get('tab'));

  const site = getSiteById(siteId ?? null);
  const area = siteId ? siteAreaOf(siteId) : null;

  // 빠른 입력 저장 후 이 화면의 '현황'·'입력 이력' 이 옛 값을 보여주지 않도록 다시 읽는다.
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, error, isLoading } = useCentralData(
    () =>
      Promise.all([listSiteQuickStatus(), listInventoryStatus(), listSubmissions()]).then(
        ([quickStatus, inventory, submissions]) => ({ quickStatus, inventory, submissions }),
      ),
    [siteId, refreshKey],
  );

  // 아직 못 읽은 상태를 "입력 없음"으로 부르지 않는다.
  const fieldStatusUnknown = data === null;
  const row = useMemo(() => {
    if (!siteId) return null;
    return buildSiteRows(data?.quickStatus ?? null).find((r) => r.site.id === siteId) ?? null;
  }, [data, siteId]);

  // 이 거점이 속한 읍면동의 중앙 자료. 거점 단위 재고는 아직 중앙에 없다 — 읍면동 단위가 최소 단위다.
  const areaInventory = useMemo(
    () => (data?.inventory ?? []).filter((item) => item.organizationName === area),
    [data, area],
  );
  const areaSubmissions = useMemo(
    () => (data?.submissions ?? []).filter((submission) => submission.organizationName === area),
    [data, area],
  );

  function selectTab(key: TabKey) {
    setSearchParams(key === 'status' ? {} : { tab: key }, { replace: true });
  }

  if (!site) {
    return (
      <div className="space-y-5">
        <PageHeader title="거점 상세" />
        <EmptyState title="존재하지 않는 거점입니다" message="거점 목록에서 다시 선택해 주세요." />
        <Link to="/admin/sites" className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600">
          <ArrowLeft size={16} /> 거점 운영으로 돌아가기
        </Link>
      </div>
    );
  }

  const actions = getActionItemsBySite(site.id);

  return (
    <div className="space-y-5">
      <Link
        to="/admin/sites"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-teal-600"
      >
        <ArrowLeft size={16} /> 거점 운영
      </Link>

      <PageHeader
        title={site.displayName}
        description={site.name}
        actions={<SiteStatusBadge status={site.status} />}
      />

      <div className="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1" role="tablist" aria-label="거점 상세 탭">
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

      {/* ── 현황 ─────────────────────────────────────────────── */}
      {activeTab === 'status' && (
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-900">지금 상태</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile
                label="시민 화면에 보이는 상태"
                value={
                  fieldStatusUnknown
                    ? '확인 중'
                    : row?.quickStatus
                      ? availabilityLabel(row.quickStatus.availability)
                      : '입력 없음'
                }
                tone={row?.quickStatus && !fieldStatusUnknown ? 'default' : 'muted'}
              />
              <Tile
                label="최근 갱신"
                value={fieldStatusUnknown ? '확인 중' : row ? updateGapLabel(row) : '—'}
                tone={!fieldStatusUnknown && row?.needsUpdate ? 'warning' : 'default'}
              />
              <Tile label="주요 품목" value={row?.quickStatus?.focusItem ?? site.focusItem} />
              <Tile
                label="부족 수량"
                value={site.expectedShortage > 0 ? `${formatNumber(site.expectedShortage)}개` : '없음'}
                tone={site.expectedShortage > 0 ? 'danger' : 'default'}
              />
            </dl>
            {row?.quickStatus?.note && (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                현장 메모: {row.quickStatus.note}
              </p>
            )}
            <button
              type="button"
              onClick={() => selectTab('quick')}
              className="mt-3 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              현황 갱신하기
            </button>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-900">거점 정보</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <InfoRow label="구 · 읍면동" value={`${REGION_NAMES[site.district]} · ${area ?? '—'}`} />
              <InfoRow label="기관 유형" value={site.facilityType} />
              {site.address && (
                <InfoRow
                  label="주소"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={13} className="shrink-0 text-slate-400" />
                      {site.address}
                    </span>
                  }
                />
              )}
              {site.phone && (
                <InfoRow
                  label="전화"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={13} className="shrink-0 text-slate-400" />
                      {site.phone}
                    </span>
                  }
                />
              )}
            </dl>
          </section>

          {actions.length > 0 && (
            <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-5">
              <h3 className="text-base font-semibold text-slate-900">확인이 필요한 사항</h3>
              <ul className="mt-3 space-y-2">
                {actions.map((action) => (
                  <li key={action.id} className="rounded-lg border border-amber-100 bg-white px-4 py-2.5 text-sm">
                    <p className="font-medium text-slate-800">
                      {action.kind} · {action.summary}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{action.suggestion}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-amber-800/70">거점 시연 수치 기준입니다.</p>
            </section>
          )}
        </div>
      )}

      {/* ── 빠른 입력 ─────────────────────────────────────────── */}
      {activeTab === 'quick' && (
        <section className="max-w-[560px] rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-900">{site.displayName} 현황 입력</h3>
          <p className="mt-1 text-sm text-slate-500">저장하면 시민 화면의 &quot;지금 상태&quot;가 바로 바뀝니다.</p>
          <div className="mt-4">
            <QuickStatusForm fixedSiteId={site.id} onSaved={() => setRefreshKey((k) => k + 1)} />
          </div>
        </section>
      )}

      {/* ── 재고 ─────────────────────────────────────────────── */}
      {activeTab === 'inventory' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-900">{area ?? '—'} 보유 물품</h3>
          <p className="mt-1 text-sm text-slate-500">
            중앙 저장소에 올라온 제출 자료 기준입니다. 재고는 읍면동 단위로 집계되므로 같은 읍면동의 거점은 같은 값을
            봅니다.
          </p>
          <div className="mt-4">
            <CentralDataNotice
              isLoading={isLoading}
              error={error}
              isEmpty={areaInventory.length === 0}
              emptyMessage={`${area ?? '이 읍면동'}에서 아직 올라온 물품 자료가 없습니다.`}
            />
            {areaInventory.length > 0 && (
              <DataTable<InventoryRow>
                columns={[
                  { key: 'itemName', header: '품목명', render: (r) => r.itemName },
                  { key: 'inboundQuantity', header: '입고량', render: (r) => formatNumber(r.inboundQuantity) },
                  { key: 'outboundQuantity', header: '배부량', render: (r) => formatNumber(r.outboundQuantity) },
                  { key: 'stock', header: '현재 재고', render: (r) => formatStock(r.stock) },
                  {
                    key: 'expirationDate',
                    header: '유통기한',
                    render: (r) => (r.expirationDate ? formatDate(r.expirationDate) : '—'),
                  },
                  { key: 'status', header: '상태', render: (r) => <StatusBadge status={inventoryStatusOf(r)} /> },
                ]}
                data={areaInventory}
                rowKey={(r) => `${r.organizationId}-${r.itemName}`}
                emptyMessage="보유 물품이 없습니다."
              />
            )}
          </div>
        </section>
      )}

      {/* ── 입력 이력 ─────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-900">현장 빠른 입력</h3>
            {row?.quickStatus ? (
              <div className="mt-3 rounded-lg border border-slate-100 px-4 py-3 text-sm">
                <p className="font-medium text-slate-800">
                  {availabilityLabel(row.quickStatus.availability)}
                  {row.quickStatus.focusItem ? ` · ${row.quickStatus.focusItem}` : ''}
                </p>
                {row.quickStatus.note && <p className="mt-1 text-xs text-slate-500">{row.quickStatus.note}</p>}
                <p className="mt-1 text-xs text-slate-400">{formatUpdatedAt(row.quickStatus.updatedAt)} 저장</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">아직 현장에서 저장한 현황이 없습니다.</p>
            )}
            <p className="mt-2 text-[11px] text-slate-400">
              현재 저장소는 거점별 최신 상태 1건만 보관합니다(덮어쓰기). 시간대별 변경 이력은 남기지 않습니다.
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-900">{area ?? '—'} 자료 제출 이력</h3>
            <p className="mt-1 text-sm text-slate-500">이 거점이 속한 읍면동이 올린 Excel 제출본입니다.</p>
            <div className="mt-4">
              <CentralDataNotice
                isLoading={isLoading}
                error={error}
                isEmpty={areaSubmissions.length === 0}
                emptyMessage={`${area ?? '이 읍면동'}에서 아직 제출한 자료가 없습니다.`}
              />
              {areaSubmissions.length > 0 && (
                <DataTable<RemoteSubmissionSummary>
                  columns={[
                    {
                      key: 'types',
                      header: '자료',
                      render: (s) => (s.types.length === 0 ? '내용 없음' : s.types.map((t) => t.label).join(' · ')),
                    },
                    { key: 'recordCount', header: '읽은 행', render: (s) => `${formatNumber(s.recordCount)}행` },
                    {
                      key: 'issueCount',
                      header: '검수',
                      render: (s) =>
                        s.issueCount > 0 ? (
                          <span className="text-amber-600">확인 필요 {formatNumber(s.issueCount)}건</span>
                        ) : (
                          '제출완료'
                        ),
                    },
                    {
                      key: 'uploadedAt',
                      header: '제출 시각',
                      render: (s) => <span className="text-slate-400">{formatUpdatedAt(s.uploadedAt)}</span>,
                    },
                    {
                      key: 'link',
                      header: '',
                      render: (s) => (
                        <Link to={`/admin/files/${s.id}`} className="text-xs font-medium text-teal-700 hover:underline">
                          열기
                        </Link>
                      ),
                    },
                  ]}
                  data={areaSubmissions}
                  rowKey={(s) => s.id}
                  emptyMessage="제출 이력이 없습니다."
                />
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'muted' | 'warning' | 'danger';
}) {
  const valueClass =
    tone === 'muted'
      ? 'text-slate-400'
      : tone === 'warning'
        ? 'text-amber-700'
        : tone === 'danger'
          ? 'text-rose-600'
          : 'text-slate-900';
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-1 truncate text-base font-semibold ${valueClass}`}>{value}</dd>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-24 shrink-0 text-slate-400">{label}</dt>
      <dd className="min-w-0 text-slate-700">{value}</dd>
    </div>
  );
}
