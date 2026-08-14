import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

/**
 * 한 화면의 행동 위계를 딱 세 단으로 고정한다.
 *   primary   — 화면당 1개. 지금 눌러야 할 것.
 *   secondary — 화면당 최대 2개. 다른 길.
 *   quiet     — 밑줄 텍스트. 되돌아가기·취소처럼 거의 안 쓰는 것.
 * 색을 새로 만들지 않는다 — 이 세 가지 밖의 버튼은 만들지 않는다.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'quiet';
export type ButtonSize = 'lg' | 'md';

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-raise hover:bg-brand-700 active:bg-brand-800 disabled:bg-line-200 disabled:text-ink-400 disabled:shadow-none',
  secondary:
    'bg-surface text-ink-950 border border-line-200 hover:border-brand-300 hover:text-brand-700 active:bg-brand-50 disabled:text-ink-400 disabled:border-line-100',
  quiet:
    'bg-transparent text-ink-600 underline underline-offset-4 hover:text-brand-700 disabled:text-ink-400 disabled:no-underline',
};

const SIZE: Record<ButtonSize, string> = {
  // 핵심 CTA — 56px 이상, 18px Semibold
  lg: 'tap-lg px-5 text-action rounded-control',
  // 일반 버튼 — 48px 이상, 17px
  md: 'tap-md px-4 text-body font-semibold rounded-control',
};

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  /** 내부 라우팅 */
  to?: string;
  /** 외부 링크 · tel: */
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  block?: boolean;
  className?: string;
}

/**
 * 공용 버튼. 아이콘만 있는 버튼은 만들 수 없다 — children(텍스트)이 필수 prop 이라
 * 아이콘은 항상 말과 함께 나간다.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'lg',
  icon: Icon,
  to,
  href,
  onClick,
  type = 'button',
  disabled = false,
  block = true,
  className = '',
}: ButtonProps) {
  const cls = [
    'inline-flex items-center justify-center gap-2 text-center transition-colors focus-ring',
    variant === 'quiet' ? '' : 'font-semibold',
    block ? 'w-full' : '',
    disabled ? 'cursor-not-allowed' : '',
    VARIANT[variant],
    variant === 'quiet' ? 'tap-md px-2 text-body' : SIZE[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      {Icon && <Icon size={size === 'lg' ? 22 : 20} className="shrink-0" aria-hidden />}
      <span>{children}</span>
    </>
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    );
  }

  if (href && !disabled) {
    const external = href.startsWith('http') || href.startsWith('//');
    return (
      <a href={href} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {inner}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}
