import type { SiteStatus } from '../../types';
import { SITE_STATUS_BADGE_STYLES, SITE_STATUS_LABELS } from '../../data/regionMeta';

interface SiteStatusBadgeProps {
  status: SiteStatus;
}

/** 거점·구역 운영 상태 배지. 기존 StatusBadge 와 같은 형태를 유지한다. */
export default function SiteStatusBadge({ status }: SiteStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${SITE_STATUS_BADGE_STYLES[status]}`}
    >
      {SITE_STATUS_LABELS[status]}
    </span>
  );
}
