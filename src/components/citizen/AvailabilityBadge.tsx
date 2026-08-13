import { CircleCheck, CircleHelp, TriangleAlert, type LucideIcon } from 'lucide-react';
import { AVAILABILITY_LABEL, type SiteAvailability } from '../../utils/citizenSite';

const STYLE: Record<SiteAvailability, string> = {
  available: 'bg-emerald-50 text-emerald-800 ring-emerald-600/30',
  low: 'bg-amber-50 text-amber-800 ring-amber-600/30',
  unknown: 'bg-slate-100 text-slate-600 ring-slate-400/30',
};

/**
 * 상태마다 색뿐 아니라 모양이 다른 아이콘을 쓴다(원·삼각형·물음표).
 * 이모지(🟢🟠⚪)는 기기·폰트에 따라 두부(□)로 깨지고 색 말고는 구분이 없어서 쓰지 않는다.
 */
const ICON: Record<SiteAvailability, LucideIcon> = {
  available: CircleCheck,
  low: TriangleAlert,
  unknown: CircleHelp,
};

const SIZE_CLASS = {
  sm: 'text-sm px-2.5 py-1 gap-1',
  md: 'text-base px-3 py-1.5 gap-1.5',
  lg: 'text-lg px-3.5 py-2 gap-1.5',
} as const;

const ICON_SIZE = { sm: 14, md: 17, lg: 20 } as const;

interface AvailabilityBadgeProps {
  availability: SiteAvailability;
  size?: keyof typeof SIZE_CLASS;
}

/** 색만으로 상태를 전달하지 않는다 — 아이콘(모양)과 문구를 항상 함께 렌더한다. */
export default function AvailabilityBadge({ availability, size = 'md' }: AvailabilityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ring-1 ring-inset ${STYLE[availability]} ${SIZE_CLASS[size]}`}
    >
      <AvailabilityIcon availability={availability} size={ICON_SIZE[size]} />
      {AVAILABILITY_LABEL[availability]}
    </span>
  );
}

/** 배지 없이 한 줄 안에서 상태를 함께 적을 때(2·3순위 목록 등) 쓰는 아이콘만. */
export function AvailabilityIcon({ availability, size = 16 }: { availability: SiteAvailability; size?: number }) {
  const Icon = ICON[availability];
  return <Icon size={size} className="inline-block shrink-0 align-[-0.18em]" aria-hidden />;
}
