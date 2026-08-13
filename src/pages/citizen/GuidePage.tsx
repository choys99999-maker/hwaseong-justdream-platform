import { MapPin, Search, HelpCircle, Info, MessageSquare, Phone } from 'lucide-react';

interface Step {
  number: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
}

const STEPS: Step[] = [
  {
    number: 1,
    icon: <MapPin size={24} />,
    title: '내 주변 그냥드림 찾기',
    desc: '홈 화면에서 "내 주변 그냥드림 찾기"를 누르면 지도가 열려요. 지도에 있는 핀을 눌러 가까운 그냥드림 지점을 찾아보세요.',
  },
  {
    number: 2,
    icon: <Search size={24} />,
    title: '물품 찾기',
    desc: '"물품 찾기"에서 필요한 물품을 검색하거나 종류를 선택하면 해당 물품이 있는 지점을 알려드려요.',
  },
  {
    number: 3,
    icon: <HelpCircle size={24} />,
    title: '도움 요청',
    desc: '직접 오기 어렵거나 도움이 더 필요하시면 "도움 요청"을 통해 신청하세요. 익명으로도 이용할 수 있어요.',
  },
  {
    number: 4,
    icon: <Info size={24} />,
    title: '도움 정보',
    desc: '생활, 주거, 금융, 일자리 등 다양한 복지 정보를 확인하고 바로 전화 연결할 수 있어요.',
  },
  {
    number: 5,
    icon: <MessageSquare size={24} />,
    title: '말 남기기',
    desc: '이용하신 후 불편한 점이나 의견이 있으시면 익명으로 남겨주세요. 서비스 개선에 반영할게요.',
  },
];

const FAQ = [
  {
    q: '회원가입이나 로그인이 필요한가요?',
    a: '아니요. 회원가입 없이 누구나 바로 이용할 수 있어요.',
  },
  {
    q: '물품은 어떻게 받을 수 있나요?',
    a: '지도에서 지점을 찾아 직접 방문하시면 돼요. 별도 서류나 자격 심사 없이 이용할 수 있어요.',
  },
  {
    q: '재고가 없는 경우는 어떻게 하나요?',
    a: '지도 핀에서 재고 상태를 미리 확인하고 방문하세요. "도움 요청" 기능으로 필요한 물품을 신청할 수도 있어요.',
  },
  {
    q: '개인정보는 어떻게 처리되나요?',
    a: '별도의 개인정보를 수집하지 않아요. 도움 요청이나 말 남기기에서 연락처 입력은 완전히 선택사항이에요.',
  },
];

export default function GuidePage() {
  return (
    <div className="min-h-full bg-slate-50 pb-10">
      <div className="bg-white px-5 pt-5 pb-5 border-b border-slate-100 shadow-sm">
        <h1 className="text-xl font-black text-slate-900">이용 안내</h1>
        <p className="text-sm text-slate-500 mt-1">그냥드림 서비스를 쉽게 이용하는 방법을 알려드려요.</p>
      </div>

      <div className="px-5 py-5 space-y-5">
        {/* 이용 방법 */}
        <div>
          <h2 className="text-base font-black text-slate-900 mb-3">이렇게 이용하세요</h2>
          <div className="space-y-3">
            {STEPS.map((step) => (
              <div key={step.number} className="flex gap-4 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-center w-12 h-12 bg-teal-600 text-white rounded-2xl flex-shrink-0 text-xl font-black">
                  {step.number}
                </div>
                <div className="flex-1">
                  <p className="text-base font-black text-slate-900 mb-1">{step.title}</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 자주 묻는 질문 */}
        <div>
          <h2 className="text-base font-black text-slate-900 mb-3">자주 묻는 질문</h2>
          <div className="space-y-3">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <p className="text-base font-black text-teal-700 mb-2">Q. {q}</p>
                <p className="text-base text-slate-700 leading-relaxed">A. {a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 문의 */}
        <div className="bg-teal-50 rounded-2xl p-5 border-2 border-teal-100">
          <p className="text-base font-black text-teal-800 mb-1">더 궁금한 점이 있으시면</p>
          <p className="text-sm text-teal-700 mb-4">전화로 직접 도움을 받을 수 있어요.</p>
          <a
            href="tel:031-369-1000"
            className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-black text-base px-6 py-3 rounded-2xl transition-colors"
          >
            <Phone size={18} />
            031-369-1000
          </a>
          <p className="text-xs text-teal-600 mt-2">화성특례시 복지정책과 · 평일 09:00~18:00</p>
        </div>
      </div>
    </div>
  );
}
