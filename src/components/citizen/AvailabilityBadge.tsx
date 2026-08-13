import { AVAILABILITY_ICON, AVAILABILITY_LABEL, type SiteAvailability } from '../../utils/citizenSite';

const STYLE: Record<SiteAvailability, string> = {
  available: 'bg-emerald-50 text-emerald-800 ring-emerald-600/30',
  low: 'bg-amber-50 text-amber-800 ring-amber-600/30',
  unknown: 'bg-slate-100 text-slate-600 ring-slate-400/30',
};

const SIZE_CLASS = {
  sm: 'text-sm px-2.5 py-1 gap-1',
  md: 'text-base px-3 py-1.5 gap-1.5',
  lg: 'text-lg px-3.5 py-2 gap-1.5',
} as const;

interface AvailabilityBadgeProps {
  availability: SiteAvailability;
  size?: keyof typeof SIZE_CLASS;
}

/** 색만으로 상태를 전달하지 않는다 — 아이콘과 문구를 항상 함께 렌더한다. */
export default function AvailabilityBadge({ availability, size = 'md' }: AvailabilityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ring-1 ring-inset ${STYLE[availability]} ${SIZE_CLASS[size]}`}
    >
      <span aria-hidden>{AVAILABILITY_ICON[availability]}</span>
      {AVAILABILITY_LABEL[availability]}
    </span>
  );
}
