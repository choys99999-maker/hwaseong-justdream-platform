import hwaseongSignature from '../../../assets/hwaseong-signature.png';

/**
 * [화성특례시 공식 BI] + 그냥드림 잠금 조합.
 *
 * 로고는 저장소에 들어 있는 공식 시그니처 파일을 그대로 쓴다 — 다시 그리거나 색을 바꾸지
 * 않는다. 목표는 "화성시 공식 서비스라는 신뢰" 이지 "시청 홈페이지처럼 보이는 것" 이 아니라서,
 * 홈 상단과 Drawer 머리 두 곳에만 두고 나머지 화면에서는 반복하지 않는다.
 */
export default function Brand({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const logoHeight = size === 'sm' ? 15 : 20;
  const nameClass = size === 'sm' ? 'text-[17px]' : 'text-section';

  return (
    <span className="inline-flex items-center gap-2">
      <img
        src={hwaseongSignature}
        alt="화성특례시"
        style={{ height: logoHeight }}
        className="w-auto shrink-0"
      />
      <span aria-hidden className="h-4 w-px shrink-0 bg-line-200" />
      <span className={`${nameClass} font-bold tracking-tight text-ink-950`}>그냥드림</span>
    </span>
  );
}
