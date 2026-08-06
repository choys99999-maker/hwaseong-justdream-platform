import { Inbox, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  message: string;
}

export default function EmptyState({ icon: Icon = Inbox, title, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
      <Icon size={28} className="text-slate-300" />
      {title && <p className="text-sm font-medium text-slate-600">{title}</p>}
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}
