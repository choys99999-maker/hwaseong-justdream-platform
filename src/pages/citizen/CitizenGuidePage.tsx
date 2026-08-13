import { MapPin, PackageCheck, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import CitizenPageHeader from '../../components/citizen/CitizenPageHeader';

const STEPS: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: MapPin, title: '가까운 곳을 찾습니다', desc: '지도에서 내 주변이나 동네를 골라요.' },
  { icon: PackageCheck, title: '필요한 물품을 확인합니다', desc: '지금 받을 수 있는 물품과 상태를 봐요.' },
  { icon: Send, title: '방문하거나 도움을 요청합니다', desc: '직접 갈 수 있으면 길찾기, 어려우면 도움 요청을 보내요.' },
];

/** 처음 이용하는 사람을 위한 안내. 3단계로 끝낸다 — 긴 FAQ를 만들지 않는다. */
export default function CitizenGuidePage() {
  return (
    <div className="px-0 pb-[max(40px,env(safe-area-inset-bottom))]">
      <CitizenPageHeader title="이렇게 이용해요" />

      <ol className="mt-6 space-y-4 px-5">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-700 text-lg font-bold text-white">
              {i + 1}
            </span>
            <div>
              <p className="flex items-center gap-1.5 text-lg font-bold text-slate-900">
                <step.icon size={18} className="text-teal-700" aria-hidden />
                {step.title}
              </p>
              <p className="mt-1 text-base text-slate-600">{step.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
