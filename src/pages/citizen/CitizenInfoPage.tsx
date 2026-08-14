import { useState } from 'react';
import { ChevronRight, Phone } from 'lucide-react';
import AppHeader from '../../components/citizen/ui/AppHeader';

interface InfoOrg {
  name: string;
  phone: string;
  desc: string;
}

interface InfoCategory {
  key: string;
  label: string;
  orgs: InfoOrg[];
}

/**
 * 전국에 잘 알려진 공공 상담번호로 시작한다. 화성시 지역 기관 정보가 준비되면 이 목록을
 * 그것으로 바꾼다 — 실제로 확인되지 않은 번호는 절대 넣지 않는다.
 */
const CATEGORIES: InfoCategory[] = [
  {
    key: 'life',
    label: '생활',
    orgs: [
      { name: '보건복지상담센터', phone: '129', desc: '복지 서비스 전반을 상담해요 · 24시간' },
      { name: '정부민원안내콜센터', phone: '110', desc: '생활 민원을 안내해요 · 24시간' },
    ],
  },
  {
    key: 'housing',
    label: '주거',
    orgs: [{ name: 'LH 고객센터', phone: '1600-1004', desc: '임대주택과 주거 지원을 상담해요' }],
  },
  {
    key: 'finance',
    label: '금융',
    orgs: [
      { name: '서민금융통합콜센터', phone: '1397', desc: '대출과 빚 문제를 상담해요 · 24시간' },
      { name: '신용회복위원회', phone: '1600-5500', desc: '빚 갚기 조정을 상담해요' },
    ],
  },
  {
    key: 'labor',
    label: '노동',
    orgs: [{ name: '고용노동부 고객상담센터', phone: '1350', desc: '임금과 일자리 문제를 상담해요' }],
  },
];

/**
 * 도움 정보.
 *
 * 목적은 정보를 읽게 하는 것이 아니라 **연락할 곳을 찾게 하는 것**이라, 기관 하나가
 * 카드 + 버튼 두 조각이 되지 않게 했다. 카드 전체가 곧 전화 걸기 링크다 —
 * 어디를 눌러야 할지 고민할 것이 없다.
 */
export default function CitizenInfoPage() {
  const [selected, setSelected] = useState<InfoCategory | null>(null);

  if (selected) {
    return (
      <>
        <AppHeader title={selected.label} onBack={() => setSelected(null)} />
        <div className="px-5 py-6 pb-[max(32px,env(safe-area-inset-bottom))]">
          <h2 className="text-title text-ink-950">여기로 전화해 보세요</h2>
          <ul className="mt-5 space-y-3">
            {selected.orgs.map((org) => (
              <li key={org.name}>
                <a
                  href={`tel:${org.phone}`}
                  className="flex items-center gap-3 rounded-card border border-line-200 bg-surface px-4 py-4 transition-colors hover:border-brand-300 hover:bg-brand-50 focus-ring"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-lead font-bold text-ink-950">{org.name}</span>
                    <span className="mt-1 block text-note text-ink-600">{org.desc}</span>
                    <span className="mt-2 flex items-center gap-1.5 text-section text-brand-700">
                      <Phone size={20} className="shrink-0" aria-hidden />
                      {org.phone}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader title="도움 정보" />
      <div className="px-5 py-6 pb-[max(32px,env(safe-area-inset-bottom))]">
        <h2 className="text-title text-ink-950">어떤 일로 힘드세요?</h2>

        <ul className="mt-5 space-y-2">
          {CATEGORIES.map((cat) => (
            <li key={cat.key}>
              <button
                type="button"
                onClick={() => setSelected(cat)}
                className="tap-lg flex w-full items-center gap-3 rounded-card border border-line-200 bg-surface px-4 text-left transition-colors hover:border-brand-300 focus-ring"
              >
                <span className="flex-1 text-section text-ink-950">{cat.label}</span>
                <ChevronRight size={22} className="shrink-0 text-ink-400" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
