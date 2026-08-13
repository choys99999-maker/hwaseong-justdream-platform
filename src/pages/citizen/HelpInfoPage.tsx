import { useState } from 'react';
import { ExternalLink, Phone, ChevronRight, ChevronDown } from 'lucide-react';

interface InfoItem {
  title: string;
  desc: string;
  phone?: string;
  link?: string;
}

interface InfoCategory {
  emoji: string;
  label: string;
  color: string;
  bg: string;
  items: InfoItem[];
}

const INFO_CATEGORIES: InfoCategory[] = [
  {
    emoji: '🍚',
    label: '생활 도움',
    color: '#16a34a',
    bg: '#f0fdf4',
    items: [
      { title: '그냥드림', desc: '식료품·생활용품을 무료로 받을 수 있어요', phone: '031-369-1000' },
      { title: '긴급복지지원', desc: '갑작스러운 위기 상황에 긴급 생계·의료비 등을 지원해요', phone: '129' },
      { title: '복지로', desc: '다양한 정부 복지 혜택을 한번에 검색하고 신청할 수 있어요', link: 'https://www.bokjiro.go.kr' },
    ],
  },
  {
    emoji: '🏠',
    label: '주거 도움',
    color: '#2563eb',
    bg: '#eff6ff',
    items: [
      { title: '주거급여', desc: '소득이 적은 가구에 월세·수선비를 지원해요', phone: '1600-0777' },
      { title: '임시주거지원', desc: '집이 없는 분들께 임시로 지낼 곳을 연결해드려요', phone: '1522-0128' },
      { title: '화성시 주거복지센터', desc: '주거 문제 상담 및 지원을 받을 수 있어요', phone: '031-369-6700' },
    ],
  },
  {
    emoji: '💰',
    label: '금융 도움',
    color: '#d97706',
    bg: '#fffbeb',
    items: [
      { title: '국민기초생활보장', desc: '소득이 기준 이하인 가구에 생계비·의료비 등을 드려요', phone: '129' },
      { title: '차상위계층 지원', desc: '기초생활수급자보다 소득이 조금 높아도 지원받을 수 있어요', phone: '129' },
      { title: '서민금융진흥원', desc: '저신용·저소득 분들을 위한 소액 대출·금융 지원이 있어요', phone: '1397' },
    ],
  },
  {
    emoji: '💼',
    label: '일자리 도움',
    color: '#7c3aed',
    bg: '#f5f3ff',
    items: [
      { title: '화성시 노인일자리', desc: '어르신들을 위한 공공일자리를 연결해드려요', phone: '031-369-6700' },
      { title: '장애인 취업 지원', desc: '장애인 고용촉진 및 직업재활 지원을 받을 수 있어요', phone: '1588-1519' },
      { title: '고용복지플러스센터', desc: '취업 상담, 직업훈련 정보를 한 곳에서 받을 수 있어요', phone: '1350' },
    ],
  },
  {
    emoji: '📞',
    label: '전화로 상담하기',
    color: '#dc2626',
    bg: '#fff1f2',
    items: [
      { title: '복지 상담 전화 (129)', desc: '보건복지부 복지 관련 무엇이든 상담받을 수 있어요', phone: '129' },
      { title: '정신건강 위기상담 (1577-0199)', desc: '마음이 힘들고 우울할 때 24시간 상담받을 수 있어요', phone: '1577-0199' },
      { title: '여성긴급전화 (1366)', desc: '가정폭력·성폭력·스토킹 피해 시 도움을 받을 수 있어요', phone: '1366' },
      { title: '자살예방 상담전화 (1393)', desc: '스스로를 해치고 싶은 생각이 들 때 바로 전화하세요', phone: '1393' },
    ],
  },
];

function InfoCard({ item }: { item: InfoItem }) {
  const handleCall = () => {
    if (item.phone) window.location.href = `tel:${item.phone}`;
  };
  const handleLink = () => {
    if (item.link) window.open(item.link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
      <h3 className="text-base font-black text-slate-900 mb-1">{item.title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed mb-3">{item.desc}</p>
      <div className="flex gap-2">
        {item.phone && (
          <button
            type="button"
            onClick={handleCall}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors"
          >
            <Phone size={15} />
            {item.phone}
          </button>
        )}
        {item.link && (
          <button
            type="button"
            onClick={handleLink}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-sm px-4 py-2.5 rounded-xl transition-colors"
          >
            <ExternalLink size={15} />
            바로가기
          </button>
        )}
      </div>
    </div>
  );
}

export default function HelpInfoPage() {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  return (
    <div className="min-h-full bg-slate-50 pb-10">
      <div className="bg-white px-5 pt-5 pb-4 border-b border-slate-100 shadow-sm">
        <h1 className="text-xl font-black text-slate-900">도움 정보</h1>
        <p className="text-sm text-slate-500 mt-1">종류를 눌러 관련 도움 정보를 확인하세요.</p>
      </div>

      <div className="px-5 py-5 space-y-3">
        {INFO_CATEGORIES.map((cat) => {
          const isOpen = openCategory === cat.label;
          return (
            <div key={cat.label} className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
              <button
                type="button"
                onClick={() => setOpenCategory(isOpen ? null : cat.label)}
                className="w-full flex items-center gap-4 px-5 py-4 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors text-left"
                aria-expanded={isOpen}
              >
                <div
                  className="w-12 h-12 flex items-center justify-center rounded-2xl text-2xl flex-shrink-0"
                  style={{ backgroundColor: cat.bg }}
                >
                  {cat.emoji}
                </div>
                <span
                  className="flex-1 text-lg font-black"
                  style={{ color: cat.color }}
                >
                  {cat.label}
                </span>
                {isOpen ? (
                  <ChevronDown size={20} className="text-slate-400" />
                ) : (
                  <ChevronRight size={20} className="text-slate-400" />
                )}
              </button>

              {isOpen && (
                <div
                  className="px-4 pb-4 space-y-3"
                  style={{ backgroundColor: cat.bg }}
                >
                  {cat.items.map((item) => (
                    <InfoCard key={item.title} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 긴급 전화 고정 */}
      <div className="mx-5 mt-2 bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-center">
        <p className="text-base font-black text-red-700 mb-1">긴급한 상황이라면</p>
        <a
          href="tel:119"
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-black text-xl px-8 py-3 rounded-2xl transition-colors"
        >
          <Phone size={20} />
          119 신고
        </a>
      </div>
    </div>
  );
}
