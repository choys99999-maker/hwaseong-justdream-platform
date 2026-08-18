import type { ReactNode } from 'react';

interface AdminHeroProps {
  title: ReactNode;
  description?: ReactNode;
  /** CSS linear-gradient() 값. 화면마다 다른 컬러 무드를 준다. */
  gradient: string;
  actions?: ReactNode;
  /** Hero 하단에 흡수하는 작은 숫자 그룹 (별도 카드로 새로 만들지 않는다). */
  summary?: ReactNode;
}

/**
 * 관리자 desktop 4개 화면(운영 현황·거점 관리·시민 요청·자료 관리) 공통 Hero band.
 *
 * 화성 Blue 상단 accent(끝 10%만 Orange)로 어느 화면에서든 같은 브랜드 세계관을 만들고,
 * 배경 gradient만 화면마다 받아 색의 무드를 구분한다. 시민/모바일 화면은 이 컴포넌트를
 * 쓰지 않으므로 영향이 없다.
 */
export default function AdminHero({ title, description, gradient, actions, summary }: AdminHeroProps) {
  return (
    <div
      className="admin-hero-in relative mb-6 overflow-hidden rounded-[20px] px-8 py-8 sm:py-9"
      style={{ backgroundImage: gradient }}
    >
      <span className="absolute inset-x-0 top-0 h-[3px] bg-[#004696]" aria-hidden />
      <span className="absolute right-0 top-0 h-[3px] w-[10%] bg-[#DC6E2D]" aria-hidden />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[28px] font-bold leading-tight text-[#182230] sm:text-[30px]">{title}</h2>
          {description && <p className="mt-2 text-sm leading-relaxed text-[#667085]">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {summary && <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">{summary}</div>}
    </div>
  );
}
