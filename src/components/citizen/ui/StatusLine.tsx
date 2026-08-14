import { CircleCheck, CircleHelp, Clock, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PlaceStatus, StatusTone } from '../../../utils/citizenPlace';

/**
 * 상태는 색으로만 말하지 않는다 — 모양이 서로 다른 아이콘과 문장을 항상 함께 낸다.
 * (색각 이상·흑백 인쇄·저조도 화면에서도 같은 정보가 남아야 한다)
 */
const TONE: Record<StatusTone, { icon: LucideIcon; text: string; chip: string }> = {
  open: { icon: CircleCheck, text: 'text-open-700', chip: 'bg-open-50 text-open-700' },
  warn: { icon: TriangleAlert, text: 'text-warn-700', chip: 'bg-warn-50 text-warn-700' },
  closed: { icon: Clock, text: 'text-ink-600', chip: 'bg-line-100 text-ink-600' },
  unknown: { icon: CircleHelp, text: 'text-ink-600', chip: 'bg-line-100 text-ink-600' },
};

/** 시트·상세 화면의 주 상태 줄. 문장이 굵게 한 줄, 근거(운영시간)가 그 아래 한 줄. */
export default function StatusLine({ status, size = 'md' }: { status: PlaceStatus; size?: 'md' | 'lg' }) {
  const tone = TONE[status.tone];
  const Icon = tone.icon;
  return (
    <div>
      <p className={`flex items-center gap-1.5 font-bold ${tone.text} ${size === 'lg' ? 'text-section' : 'text-lead'}`}>
        <Icon size={size === 'lg' ? 22 : 20} className="shrink-0" aria-hidden />
        {status.label}
      </p>
      {status.detail && <p className="mt-0.5 pl-[26px] text-note text-ink-600">{status.detail}</p>}
    </div>
  );
}

/** 목록 안에서 한 줄로 좁게 쓸 때. 문장은 같고 크기만 줄인다. */
export function StatusChip({ status }: { status: PlaceStatus }) {
  const tone = TONE[status.tone];
  const Icon = tone.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-note font-semibold ${tone.chip}`}>
      <Icon size={16} className="shrink-0" aria-hidden />
      {status.label}
    </span>
  );
}
