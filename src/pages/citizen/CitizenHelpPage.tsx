import { Phone } from 'lucide-react';
import AppHeader from '../../components/citizen/ui/AppHeader';
import HelpRequestForm from '../../components/citizen/HelpRequestForm';
import { CITIZEN_HELP_PHONE } from '../../data/citizenContact';

/**
 * 도움 요청.
 *
 * 한 화면에 한 목적 — "어떤 도움이 필요하세요?" 를 묻고 보내는 것까지가 전부다.
 * 자격 확인·서류 안내·제도 설명은 넣지 않는다. 전화라는 다른 길은 화면 맨 아래
 * 조용한 한 줄로만 둔다(주 행동과 경쟁하지 않게).
 */
export default function CitizenHelpPage() {
  return (
    <>
      <AppHeader title="도움 요청" />
      <div className="px-5 py-6 pb-[max(32px,env(safe-area-inset-bottom))]">
        <h2 className="text-title text-ink-950">어떤 도움이 필요하세요?</h2>
        <p className="mt-2 text-body text-ink-600">
          알려주시면 담당자가 확인하고 연락드려요.
        </p>

        <div className="mt-7">
          <HelpRequestForm channel="CITIZEN" variant="citizen" doneLinkTo="/" doneLinkLabel="지도로 돌아가기" />
        </div>

        <div className="mt-8 border-t border-line-100 pt-5">
          <a
            href={`tel:${CITIZEN_HELP_PHONE}`}
            className="tap-md flex items-center justify-center gap-2 text-body text-ink-600 underline underline-offset-4 hover:text-brand-700 focus-ring"
          >
            <Phone size={18} aria-hidden />
            직접 통화를 원하시면 {CITIZEN_HELP_PHONE}
          </a>
        </div>
      </div>
    </>
  );
}
