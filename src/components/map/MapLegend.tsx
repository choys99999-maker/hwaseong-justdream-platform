import type { SiteStatus } from '../../types';
import { SITE_STATUS_COLORS, SITE_STATUS_LABELS } from '../../data/regionMeta';

const LEGEND_ORDER: SiteStatus[] = ['normal', 'shortage', 'expiring', 'missing'];

interface MapLegendProps {
  /** 'large' 는 전체화면 지도 전용 — compact 는 기본 대시보드에서 쓴다. */
  size?: 'compact' | 'large';
}

/** 색상만으로 상태를 구분하지 않도록 색 점과 텍스트를 함께 제공한다. */
export default function MapLegend({ size = 'compact' }: MapLegendProps) {
  const isLarge = size === 'large';
  return (
    <ul className={`flex flex-wrap items-center ${isLarge ? 'gap-x-5 gap-y-2' : 'gap-x-4 gap-y-1.5'}`}>
      {LEGEND_ORDER.map((status) => (
        <li
          key={status}
          className={`flex items-center gap-1.5 text-slate-500 ${isLarge ? 'text-sm' : 'text-xs'}`}
        >
          <span
            aria-hidden="true"
            className={`shrink-0 rounded-full ring-1 ring-inset ring-black/10 ${isLarge ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'}`}
            style={{ backgroundColor: SITE_STATUS_COLORS[status].fill }}
          />
          {SITE_STATUS_LABELS[status]}
        </li>
      ))}
    </ul>
  );
}
