import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'outline';
type Size = 'lg' | 'md';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800',
  secondary: 'bg-white text-slate-900 border-2 border-slate-300 hover:bg-slate-50',
  outline: 'bg-white text-teal-700 border-2 border-teal-600 hover:bg-teal-50',
};

/** 핵심 CTA(20~24px) / 일반 버튼(18~20px). 둘 다 48px 이상 터치 영역을 보장한다. */
const SIZE_CLASS: Record<Size, string> = {
  lg: 'min-h-[56px] px-6 py-4 text-xl',
  md: 'min-h-[52px] px-4 py-3.5 text-lg',
};

interface BigButtonProps {
  children: ReactNode;
  icon?: LucideIcon;
  variant?: Variant;
  size?: Size;
  to?: string;
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  fullWidth?: boolean;
}

/**
 * 고령·디지털 취약 사용자 기준을 만족하는 공용 버튼.
 * 텍스트 없이 아이콘만 있는 버튼은 만들지 않는다 — icon 은 항상 children(텍스트)과 함께 쓴다.
 */
export default function BigButton({
  children,
  icon: Icon,
  variant = 'primary',
  size = 'lg',
  to,
  href,
  onClick,
  type = 'button',
  disabled = false,
  fullWidth = true,
}: BigButtonProps) {
  const className = [
    'inline-flex items-center justify-center gap-2 rounded-2xl font-bold shadow-sm transition-colors',
    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/40',
    disabled ? 'cursor-not-allowed opacity-40' : '',
    fullWidth ? 'w-full' : '',
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {Icon && <Icon size={size === 'lg' ? 24 : 20} className="shrink-0" aria-hidden />}
      <span>{children}</span>
    </>
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  if (href && !disabled) {
    const isExternalNav = href.startsWith('http') || href.startsWith('//');
    return (
      <a
        href={href}
        className={className}
        {...(isExternalNav ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {content}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={className}>
      {content}
    </button>
  );
}
