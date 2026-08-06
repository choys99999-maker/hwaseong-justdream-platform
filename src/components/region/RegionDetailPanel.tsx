import { Link } from 'react-router-dom';
import { ArrowRight, Boxes, CalendarClock, ClipboardList, PackageOpen, Users } from 'lucide-react';
import type { Region } from '../../types';
import StatusBadge from '../common/StatusBadge';
import EmptyState from '../common/EmptyState';
import { formatDateTime, formatNumber } from '../../utils/format';

interface RegionDetailPanelProps {
  region: Region | null;
}

const METRICS = [
  { key: 'orgCount', label: '운영 기관 수', icon: Boxes, unit: '개소' },
  { key: 'userCount', label: '이용자 수', icon: Users, unit: '명' },
  { key: 'monthlySupportCount', label: '이번 달 지원 건수', icon: ClipboardList, unit: '건' },
  { key: 'inventoryCount', label: '현재 재고 품목', icon: PackageOpen, unit: '종' },
] as const;

export default function RegionDetailPanel({ region }: RegionDetailPanelProps) {
  if (!region) {
    return <EmptyState message="좌측에서 권역을 선택하면 상세 정보가 표시됩니다." />;
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{region.name}</h3>
        <StatusBadge status={region.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        {METRICS.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.key} className="rounded-lg bg-slate-50 p-3">
              <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                <Icon size={14} />
                {metric.label}
              </dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900">
                {formatNumber(region[metric.key])}
                <span className="ml-1 text-xs font-normal text-slate-400">{metric.unit}</span>
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
        <span>유통기한 임박 건수</span>
        <span className="font-semibold">{formatNumber(region.expiringSoonCount)}건</span>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
        <CalendarClock size={14} />
        최근 데이터 업데이트: {formatDateTime(region.lastUpdated)}
      </div>

      <Link
        to={`/regions/${region.id}`}
        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
      >
        상세보기
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
