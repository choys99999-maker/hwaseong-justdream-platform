const STATUS_STYLES: Record<string, string> = {
  '정상': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  '연계 완료': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  // 시민 접수 큐(도움 요청·기부) — 저장소가 가진 두 상태를 그대로 부른다.
  '접수': 'bg-sky-50 text-sky-700 ring-sky-600/20',
  '완료': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  '수령 완료': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  '주의': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  '임박': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  '연계 진행중': 'bg-sky-50 text-sky-700 ring-sky-600/20',
  '확인 필요': 'bg-slate-100 text-slate-600 ring-slate-500/20',
  '부족': 'bg-rose-50 text-rose-700 ring-rose-600/20',
  '미연계': 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

const DEFAULT_STYLE = 'bg-slate-100 text-slate-600 ring-slate-500/20';

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? DEFAULT_STYLE;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}>
      {status}
    </span>
  );
}
