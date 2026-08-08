import { Link } from 'react-router-dom';
import { ArrowRight, Boxes, CalendarClock, ClipboardList, PackageOpen, Users } from 'lucide-react';
import type { Region } from '../../types';
import SiteStatusBadge from '../common/SiteStatusBadge';
import EmptyState from '../common/EmptyState';
import { districtRiskLevels } from '../../data/operationSummary';
import { formatNumber } from '../../utils/format';
import { formatUpdatedAt } from '../../utils/submission';
import type { DistrictCentralSummary } from '../../utils/districtRollup';

interface RegionDetailPanelProps {
  region: Region | null;
  /** 선택한 구의 중앙 저장소 집계. 아직 못 읽었으면 수치를 '—' 로 둔다. */
  central?: DistrictCentralSummary;
}

const DASH = '—';

export default function RegionDetailPanel({ region, central }: RegionDetailPanelProps) {
  if (!region) {
    return <EmptyState message="좌측에서 구를 선택하면 상세 정보가 표시됩니다." />;
  }

  // 거점 수만 확정 시드 값이고, 나머지는 전부 중앙 저장소 집계다.
  const metrics = [
    { key: 'orgCount', label: '운영 거점 수', icon: Boxes, unit: '개소', value: region.orgCount },
    { key: 'userCount', label: '이용자 수', icon: Users, unit: '명', value: central?.userCount },
    {
      key: 'basicConsultation',
      label: '기본상담 건수',
      icon: ClipboardList,
      unit: '건',
      value: central?.basicConsultation,
    },
    { key: 'itemCount', label: '현재 재고 품목', icon: PackageOpen, unit: '종', value: central?.itemCount },
  ];

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{region.name}</h3>
        <SiteStatusBadge status={districtRiskLevels[region.id]} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.key} className="rounded-lg bg-slate-50 p-3">
              <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                <Icon size={14} />
                {metric.label}
              </dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900">
                {metric.value === undefined ? (
                  DASH
                ) : (
                  <>
                    {formatNumber(metric.value)}
                    <span className="ml-1 text-xs font-normal text-slate-400">{metric.unit}</span>
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
        <span>유통기한 임박 건수</span>
        <span className="font-semibold">
          {central === undefined ? DASH : `${formatNumber(central.expiringSoonCount)}건`}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
        <CalendarClock size={14} />
        최근 자료 제출: {central?.lastUploadedAt ? formatUpdatedAt(central.lastUploadedAt) : '제출 자료 없음'}
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
