import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface CitizenPageHeaderProps {
  title: string;
  backTo?: string;
  backLabel?: string;
}

/**
 * Drawer로 들어오는 시민 서브 페이지 공통 상단 — 뒤로가기 + 제목.
 *
 * 뒤로가기는 고령 사용자가 놓치지 않도록 흰 알약 버튼으로 또렷하게 둔다.
 * 텍스트 링크만 두면 "여기서 어떻게 나가지?" 가 생긴다.
 */
export default function CitizenPageHeader({
  title,
  backTo = '/',
  backLabel = '지도로 돌아가기',
}: CitizenPageHeaderProps) {
  return (
    <div className="px-5 pt-[max(20px,env(safe-area-inset-top))]">
      <Link
        to={backTo}
        className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-[16px] font-semibold text-gray-700 shadow-sm transition-colors hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <ArrowLeft size={18} className="text-blue-600" aria-hidden />
        {backLabel}
      </Link>
      <h1 className="mt-4 text-[24px] font-bold leading-snug text-gray-900">{title}</h1>
    </div>
  );
}
