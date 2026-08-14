import AppHeader from '../../components/citizen/ui/AppHeader';
import Button from '../../components/citizen/ui/Button';

/** 3단계로 끝낸다. 긴 FAQ 를 만들지 않는다 — 읽을 것이 많으면 안 읽는다. */
const STEPS = [
  { title: '가까운 곳을 찾습니다', desc: '지도에서 내 주변이나 동네를 골라요.' },
  { title: '필요한 물품을 확인합니다', desc: '지금 받을 수 있는지 한눈에 보여드려요.' },
  { title: '방문하거나 도움을 요청합니다', desc: '가기 어려우면 저희가 찾아갈게요.' },
];

export default function CitizenGuidePage() {
  return (
    <>
      <AppHeader title="이용 안내" />
      <div className="px-5 py-6 pb-[max(32px,env(safe-area-inset-bottom))]">
        <h2 className="text-title text-ink-950">이렇게 이용해요</h2>

        <ol className="mt-6 space-y-5">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex items-start gap-3.5">
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-body font-bold text-white"
              >
                {i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-lead font-bold text-ink-950">
                  <span className="sr-only">{i + 1}단계. </span>
                  {step.title}
                </p>
                <p className="mt-1 text-body text-ink-600">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10">
          <Button to="/">지도에서 찾아보기</Button>
        </div>
      </div>
    </>
  );
}
