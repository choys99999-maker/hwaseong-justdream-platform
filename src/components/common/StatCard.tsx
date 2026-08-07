import type { LucideIcon } from 'lucide-react';

type StatCardTone = 'default' | 'warning' | 'danger';

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
}

export default function StatCard({ label, value, icon: Icon, tone = 'default', description }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1.5 text-xl font-semibold text-slate-900">{value}</p>
          {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_STYLES[tone]}`}>
          <Icon size={17} />
        </div>
      </div>
    </div>
  );
}
