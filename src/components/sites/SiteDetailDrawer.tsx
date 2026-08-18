import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone } from 'lucide-react';
import SideDrawer from '../common/SideDrawer';
import SiteStatusBadge from '../common/SiteStatusBadge';
import QuickStatusForm, { availabilityLabel } from './QuickStatusForm';
import { getActionItemsBySite } from '../../data/actionItems';
import { siteAreaOf } from '../../data/mockSites';
import { REGION_NAMES } from '../../data/regionMeta';
import { updateGapLabel, type SiteOperationRow } from '../../utils/siteOperations';
import { formatNumber } from '../../utils/format';

interface SiteDetailDrawerProps {
  row: SiteOperationRow;
  /** 현장 입력을 아직 못 읽은 상태. 못 읽은 것을 '입력 없음'이라 부르지 않는다. */
  fieldStatusUnknown: boolean;
  /** 열자마자 현황 수정 상태로 시작한다(오늘 할 일에서 '갱신 필요'를 눌러 들어온 경우). */
  startEditing?: boolean;
  onClose: () => void;
  /** 저장 후 목록이 옛 값을 보여주지 않게 한다. */
  onSaved: () => void;
}

/**
 * 거점 상세 패널.
 *
 * 예전에는 거점을 누르면 별도 페이지가 열리고 그 안에 현황·빠른 입력·재고·입력 이력
 * 네 탭이 또 있었다. 담당자가 실제로 하는 일은 둘뿐이다 —
 * "지금 어떤 상태인지 본다", "상태를 고친다". 그래서 목록 옆 패널 하나로 끝낸다.
 * 물품 하나하나까지 보려면 [전체 재고 보기]로 재고 탭에 넘긴다.
 */
export default function SiteDetailDrawer({
  row,
  fieldStatusUnknown,
  startEditing = false,
  onClose,
  onSaved,
}: SiteDetailDrawerProps) {
  const [editing, setEditing] = useState(startEditing);
  const { site } = row;
  const area = siteAreaOf(site.id);
  const actions = getActionItemsBySite(site.id);

  const currentStatus = fieldStatusUnknown
    ? '확인 중'
    : row.quickStatus
      ? availabilityLabel(row.quickStatus.availability)
      : '입력 없음';

  return (
    <SideDrawer
      title={site.displayName}
      description={`${REGION_NAMES[site.district]} · ${area ?? '—'}`}
      titleAside={<SiteStatusBadge status={site.status} />}
      onClose={onClose}
    >
      {editing ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">현황 수정</h3>
            <p className="mt-1 text-sm text-slate-500">
              저장하면 시민 화면의 &quot;지금 상태&quot;가 바로 바뀝니다.
            </p>
          </div>
          <QuickStatusForm
            fixedSiteId={site.id}
            onSaved={() => {
              onSaved();
              setEditing(false);
            }}
          />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            취소
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <dl className="space-y-2 text-sm">
            <Row label="현재 상태" value={currentStatus} tone={row.quickStatus ? 'default' : 'muted'} />
            <Row
              label="최근 갱신"
              value={fieldStatusUnknown ? '확인 중' : updateGapLabel(row)}
              tone={!fieldStatusUnknown && row.needsUpdate ? 'warning' : 'default'}
            />
            <Row label="주요 품목" value={row.quickStatus?.focusItem ?? site.focusItem} />
            <Row
              label="부족 수량"
              value={site.expectedShortage > 0 ? `${formatNumber(site.expectedShortage)}개` : '없음'}
              tone={site.expectedShortage > 0 ? 'danger' : 'default'}
            />
            {site.address && (
              <Row
                label="주소"
                value={
                  <span className="inline-flex items-start gap-1.5">
                    <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />
                    {site.address}
                  </span>
                }
              />
            )}
            {site.phone && (
              <Row
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

          {row.quickStatus?.note && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              현장 메모: {row.quickStatus.note}
            </p>
          )}

          {(actions.length > 0 || (!fieldStatusUnknown && row.needsUpdate)) && (
            <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <h3 className="text-sm font-semibold text-slate-900">확인 필요</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                {actions.map((action) => (
                  <li key={action.id}>
                    {action.summary}
                    <span className="ml-1 text-xs text-slate-500">· {action.suggestion}</span>
                  </li>
                ))}
                {!fieldStatusUnknown && row.needsUpdate && <li>{updateGapLabel(row)}</li>}
              </ul>
            </section>
          )}

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              현황 수정
            </button>
            <Link
              to={`/admin/sites/inventory${area ? `?q=${encodeURIComponent(area)}` : ''}`}
              className="block rounded-lg border border-slate-200 py-2.5 text-center text-sm font-medium text-slate-600 transition-colors hover:border-teal-300 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              전체 재고 보기
            </Link>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-400">
            현재 상태·최근 갱신은 현장에서 저장한 실제 값입니다. 부족 수량·확인 필요는 아직 거점 시연
            수치입니다.
          </p>
        </div>
      )}
    </SideDrawer>
  );
}

function Row({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'muted' | 'warning' | 'danger';
}) {
  const valueClass =
    tone === 'muted'
      ? 'text-slate-400'
      : tone === 'warning'
        ? 'font-medium text-amber-700'
        : tone === 'danger'
          ? 'font-medium text-rose-600'
          : 'text-slate-800';
  return (
    <div className="flex gap-4">
      <dt className="w-20 shrink-0 text-slate-400">{label}</dt>
      <dd className={`min-w-0 break-words ${valueClass}`}>{value}</dd>
    </div>
  );
}
