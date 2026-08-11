import type { LucideIcon } from 'lucide-react';

type StatCardTone = 'default' | 'warning' | 'danger';
type StatCardSize = 'default' | 'compact';

const TONE_STYLES: Record<StatCardTone, string> = {
  default: 'bg-teal-50 text-teal-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-rose-50 text-rose-600',
};

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: StatCardTone;
  description?: string;
  /** compact: 시연/부가 지표용 — 핵심 KPI보다 한 단계 낮은 시각 위계 */
  size?: StatCardSize;
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  description,
  size = 'default',
}: StatCardProps) {
  const isCompact = size === 'compact';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p
            className={
              isCompact
                ? 'mt-1.5 text-lg font-semibold text-slate-800'
                : 'mt-1.5 text-[28px] font-bold leading-none text-slate-900'
            }
          >
            {value}
          </p>
          {description && <p className="mt-1.5 text-xs text-slate-400">{description}</p>}
        </div>
        <div
          className={`flex shrink-0 items-center justify-center rounded-lg ${TONE_STYLES[tone]} ${
            isCompact ? 'h-7 w-7' : 'h-8 w-8'
          }`}
        >
          <Icon size={isCompact ? 15 : 17} />
        </div>
      </div>
    </div>
  );
}
