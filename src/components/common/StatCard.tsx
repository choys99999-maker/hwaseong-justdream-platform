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
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
          {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${TONE_STYLES[tone]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}
