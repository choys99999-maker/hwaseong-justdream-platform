import { useState } from 'react';
import { ArrowLeft, Briefcase, ChevronRight, Coins, Home as HomeIcon, HeartPulse, Phone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import CitizenPageHeader from '../../components/citizen/CitizenPageHeader';
import BigButton from '../../components/citizen/BigButton';

interface InfoOrg {
  name: string;
  phone: string;
  desc: string;
}

interface InfoCategory {
  key: string;
  label: string;
  icon: LucideIcon;
  orgs: InfoOrg[];
}

/**
 * 전국에 잘 알려진 공공 상담번호로 시작한다(사용자 확인 완료). 화성시 지역 기관 정보가
 * 준비되면 이 목록을 그것으로 바꾼다 — 실제로 확인되지 않은 번호는 절대 넣지 않는다.
 */
const CATEGORIES: InfoCategory[] = [
  {
    key: 'life',
    label: '생활',
    icon: HeartPulse,
    orgs: [
      { name: '보건복지상담센터', phone: '129', desc: '복지 서비스 전반을 상담해요 (24시간)' },
      { name: '정부민원안내콜센터', phone: '110', desc: '생활 민원을 안내해요 (24시간)' },
    ],
  },
  {
    key: 'housing',
    label: '주거',
    icon: HomeIcon,
    orgs: [{ name: 'LH 고객센터', phone: '1600-1004', desc: '임대주택·주거 지원을 상담해요' }],
  },
  {
    key: 'finance',
    label: '금융',
    icon: Coins,
    orgs: [
      { name: '서민금융통합콜센터', phone: '1397', desc: '대출·빚 문제를 상담해요 (24시간)' },
      { name: '신용회복위원회', phone: '1600-5500', desc: '빚 갚기 조정을 상담해요' },
    ],
  },
  {
    key: 'labor',
    label: '노동',
    icon: Briefcase,
    orgs: [{ name: '고용노동부 고객상담센터', phone: '1350', desc: '임금·근로 문제를 상담해요' }],
  },
];

/** Drawer → 도움 정보. 목적은 많이 읽히는 게 아니라 어디에 전화해야 할지 빨리 찾게 하는 것. */
export default function CitizenInfoPage() {
  const [selected, setSelected] = useState<InfoCategory | null>(null);

  if (selected) {
    return (
      <div className="px-0 pb-[max(40px,env(safe-area-inset-bottom))]">
        <div className="px-5 pt-6">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="inline-flex min-h-[48px] items-center gap-1.5 text-lg font-medium text-slate-500 hover:text-teal-700"
          >
            <ArrowLeft size={20} aria-hidden /> 다른 분야 보기
          </button>
          <h1 className="mt-3 flex items-center gap-2 text-[24px] font-bold leading-snug text-slate-900">
            <selected.icon size={22} className="text-teal-700" aria-hidden />
            {selected.label}
          </h1>
        </div>

        <ul className="mt-5 space-y-3 px-5">
          {selected.orgs.map((org) => (
            <li key={org.name} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-lg font-bold text-slate-900">{org.name}</p>
              <p className="mt-1 text-base text-slate-600">{org.desc}</p>
              <div className="mt-3">
                <BigButton href={`tel:${org.phone}`} icon={Phone} size="md">
                  전화하기 · {org.phone}
                </BigButton>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="px-0 pb-[max(40px,env(safe-area-inset-bottom))]">
      <CitizenPageHeader title="도움 정보" />
      <p className="px-5 mt-1 text-base text-slate-500">어디에 연락해야 할지 빠르게 찾아드려요.</p>

      <ul className="mt-5 space-y-2.5 px-5">
        {CATEGORIES.map((cat) => (
          <li key={cat.key}>
            <button
              type="button"
              onClick={() => setSelected(cat)}
              className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-teal-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                <cat.icon size={22} aria-hidden />
              </span>
              <span className="flex-1 text-xl font-bold text-slate-900">{cat.label}</span>
              <ChevronRight size={20} className="shrink-0 text-slate-300" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
