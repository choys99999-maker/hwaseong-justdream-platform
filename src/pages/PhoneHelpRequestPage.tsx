import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import HelpRequestForm from '../components/citizen/HelpRequestForm';

/**
 * 전화 접수 대신 입력. 디지털 사용이 어려운 시민이 전화로 도움을 요청하면
 * 담당자가 이 화면에서 같은 폼(HelpRequestForm)에 대신 입력한다 — 시민 `/help`
 * 직접 입력과 저장 방식·큐가 완전히 같다(channel 만 다르다).
 */
export default function PhoneHelpRequestPage() {
  return (
    <div className="mx-auto w-full max-w-[560px] space-y-4">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-teal-600"
      >
        <ArrowLeft size={16} /> 오늘 할 일
      </Link>

      <PageHeader
        title="전화 접수 대신 입력"
        description="전화로 도움을 요청한 시민의 내용을 대신 입력합니다. 저장하면 시민이 직접 넣은 요청과 같은 목록(시민 접수 > 도움 요청)에 표시됩니다."
      />

      <div className="rounded-xl border border-slate-200 bg-white">
        <HelpRequestForm channel="PHONE" doneLinkTo="/admin/intake" doneLinkLabel="시민 접수로 돌아가기" />
      </div>
    </div>
  );
}
