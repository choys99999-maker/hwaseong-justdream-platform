import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface CitizenPageHeaderProps {
  title: string;
  backTo?: string;
  backLabel?: string;
}

/** Drawer로 들어오는 시민 서브 페이지 공통 상단 — 뒤로가기 + 제목. */
export default function CitizenPageHeader({ title, backTo = '/', backLabel = '지도로 돌아가기' }: CitizenPageHeaderProps) {
  return (
    <div className="px-5 pt-6">
      <Link
        to={backTo}
        className="inline-flex min-h-[48px] items-center gap-1.5 text-lg font-medium text-slate-500 hover:text-teal-700"
      >
        <ArrowLeft size={20} aria-hidden /> {backLabel}
      </Link>
      <h1 className="mt-3 text-[24px] font-bold leading-snug text-slate-900">{title}</h1>
    </div>
  );
}
