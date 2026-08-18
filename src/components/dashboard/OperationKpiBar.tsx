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

/** 화성 컬러 시스템 — 상태마다 아주 옅은 tint 위에 진한 숫자. 강하지 않게. */
const KPI_TONE: Record<KpiStatus, { idleBg: string; text: string; activeBg: string; activeBorder: string; dot?: string }> = {
  ALL: { idleBg: '#EAF3FC', text: '#004696', activeBg: '#DCEAFA', activeBorder: '#9DC1EB' },
  normal: { idleBg: '#EDF8F3', text: '#159A68', activeBg: '#DBF1E6', activeBorder: '#8FCFAE', dot: '#159A68' },
  shortage: { idleBg: '#FDEFF0', text: '#E5484D', activeBg: '#FBDEE0', activeBorder: '#EE9FA3', dot: '#E5484D' },
  needsCheck: { idleBg: '#FFF3E8', text: '#DC6E2D', activeBg: '#FCE3CC', activeBorder: '#EBAD7C', dot: '#DC6E2D' },
};

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
  const tone = KPI_TONE[status];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        backgroundColor: active ? tone.activeBg : tone.idleBg,
        borderColor: active ? tone.activeBorder : 'transparent',
        color: tone.text,
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
    >
      {tone.dot && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tone.dot }} />}
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
