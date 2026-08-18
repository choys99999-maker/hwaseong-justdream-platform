import { ChevronRight } from 'lucide-react';
import type { OperationSite } from '../../types';

/**
 * 운영 현황 KPI. 마커 색상 4종(normal/shortage/expiring/missing) 중
 * expiring·missing 은 "확인 필요"로 묶어 보여준다 — 거점 관리 목록 필터와 같은 분류다.
 */
export type KpiStatus = 'ALL' | 'normal' | 'shortage' | 'needsCheck';

interface OperationKpiBarProps {
  /** 이미 선택된 구로 좁혀진 거점 목록(구 미선택 시 전체). 카운트만 이 범위를 따른다. */
  scopeSites: OperationSite[];
  districtName: string | null;
  value: KpiStatus;
  onChange: (value: KpiStatus) => void;
  onClearDistrict: () => void;
}

const KPI_STYLE: Record<Exclude<KpiStatus, 'ALL'>, { dot: string; active: string }> = {
  normal: { dot: 'bg-emerald-500', active: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
  shortage: { dot: 'bg-rose-500', active: 'border-rose-400 bg-rose-50 text-rose-800' },
  needsCheck: { dot: 'bg-amber-500', active: 'border-amber-400 bg-amber-50 text-amber-800' },
};

const INACTIVE_CLASS = 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50';
const ALL_ACTIVE_CLASS = 'border-slate-400 bg-slate-100 text-slate-800';

function KpiButton({
  label,
  count,
  status,
  active,
  onClick,
}: {
  label: string;
  count: number;
  status: KpiStatus;
  active: boolean;
  onClick: () => void;
}) {
  const style = status === 'ALL' ? null : KPI_STYLE[status];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
        active ? (style ? style.active : ALL_ACTIVE_CLASS) : INACTIVE_CLASS
      }`}
    >
      {style && <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />}
      {label}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

/**
 * 화성시 전체 운영 현황판의 KPI 겸 지도 필터.
 * 카드가 아니라 눌리는 버튼이다 — 선택하면 지도 마커와 우측 패널이 그 상태 기준으로 바뀐다.
 */
export default function OperationKpiBar({
  scopeSites,
  districtName,
  value,
  onChange,
  onClearDistrict,
}: OperationKpiBarProps) {
  const total = scopeSites.length;
  const normal = scopeSites.filter((site) => site.status === 'normal').length;
  const shortage = scopeSites.filter((site) => site.status === 'shortage').length;
  const needsCheck = scopeSites.filter((site) => site.status === 'expiring' || site.status === 'missing').length;

  return (
    <div className="flex flex-col gap-1.5">
      {districtName && (
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <span>화성시 전체</span>
          <ChevronRight size={12} className="text-slate-300" aria-hidden />
          <span className="font-medium text-slate-700">{districtName}</span>
          <button
            type="button"
            onClick={onClearDistrict}
            className="ml-2 font-medium text-teal-600 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            전체로 돌아가기
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="운영 현황 KPI 필터">
        <KpiButton
          status="ALL"
          label={districtName ? `${districtName} 거점` : '전체 거점'}
          count={total}
          active={value === 'ALL'}
          onClick={() => onChange('ALL')}
        />
        <KpiButton status="normal" label="정상" count={normal} active={value === 'normal'} onClick={() => onChange('normal')} />
        <KpiButton
          status="shortage"
          label="물품 부족"
          count={shortage}
          active={value === 'shortage'}
          onClick={() => onChange('shortage')}
        />
        <KpiButton
          status="needsCheck"
          label="확인 필요"
          count={needsCheck}
          active={value === 'needsCheck'}
          onClick={() => onChange('needsCheck')}
        />
      </div>
    </div>
  );
}
