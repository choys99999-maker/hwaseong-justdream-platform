import { Link } from 'react-router-dom';
import { ArrowLeft, PhoneCall } from 'lucide-react';
import { CITIZEN_HELP_PHONE, CITIZEN_HELP_PHONE_DISPLAY } from '../../data/citizenContact';
import HelpRequestForm from '../../components/citizen/HelpRequestForm';
import BigButton from '../../components/citizen/BigButton';

/**
 * 도움 요청. 정보를 확인해도 직접 거점까지 갈 수 없는 시민을 놓치지 않는 것이 목적이다.
 * 필수 입력만 받는다 — 주민번호·소득 증명·긴 사유서는 요구하지 않는다.
 */
export default function CitizenHelpPage() {
  return (
    <div className="px-5 py-6 pb-10">
      <Link
        to="/"
        className="inline-flex min-h-[48px] items-center gap-1.5 text-lg font-medium text-slate-500 hover:text-teal-700"
      >
        <ArrowLeft size={20} /> 목록으로
      </Link>

      <h1 className="mt-3 text-[24px] font-bold leading-snug text-slate-900">도움이 필요하신가요?</h1>
      <p className="mt-2 text-lg text-slate-600">연락처와 사는 동네만 알려주시면 담당자가 확인 후 연락드려요.</p>

      <div className="mt-5">
        <BigButton href={`tel:${CITIZEN_HELP_PHONE}`} variant="outline" icon={PhoneCall}>
          전화로 도와주세요
        </BigButton>
        <p className="mt-2 text-center text-base text-slate-400">{CITIZEN_HELP_PHONE_DISPLAY}</p>
      </div>

      <div className="mt-6 border-t border-slate-100 pt-6">
        <HelpRequestForm channel="CITIZEN" doneLinkTo="/" doneLinkLabel="처음으로" />
      </div>
    </div>
  );
}
