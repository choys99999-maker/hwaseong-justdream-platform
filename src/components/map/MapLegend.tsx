import type { SiteStatus } from '../../types';
import { SITE_STATUS_COLORS, SITE_STATUS_LABELS } from '../../data/regionMeta';

const LEGEND_ORDER: SiteStatus[] = ['normal', 'shortage', 'expiring', 'surplus', 'missing'];

/** 색상만으로 상태를 구분하지 않도록 색 점과 텍스트를 함께 제공한다. */
export default function MapLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {LEGEND_ORDER.map((status) => (
        <li key={status} className="flex items-center gap-1.5 text-xs text-slate-500">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
            style={{ backgroundColor: SITE_STATUS_COLORS[status].fill }}
          />
          {SITE_STATUS_LABELS[status]}
        </li>
      ))}
    </ul>
  );
}
