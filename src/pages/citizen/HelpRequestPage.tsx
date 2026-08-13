import { useState } from 'react';
import { CheckCircle } from 'lucide-react';

type HelpType =
  | '먹을 것이 필요해요'
  | '생활용품이 필요해요'
  | '이동하기 어려워요'
  | '생활에 어려움이 있어요'
  | '상담받고 싶어요'
  | '기타';

const HELP_TYPES: { label: HelpType; emoji: string }[] = [
  { label: '먹을 것이 필요해요', emoji: '🍚' },
  { label: '생활용품이 필요해요', emoji: '🧹' },
  { label: '이동하기 어려워요', emoji: '🚌' },
  { label: '생활에 어려움이 있어요', emoji: '🏠' },
  { label: '상담받고 싶어요', emoji: '💬' },
  { label: '기타', emoji: '📝' },
];

export default function HelpRequestPage() {
  const [selectedType, setSelectedType] = useState<HelpType | null>(null);
  const [content, setContent] = useState('');
  const [phone, setPhone] = useState('');
  const [wantContact, setWantContact] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = selectedType !== null && content.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    // 실제 구현 시 API 호출로 대체
    console.log({ type: selectedType, content, phone: wantContact ? phone : '익명' });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 text-center">
        <CheckCircle size={72} className="text-teal-500 mb-5" />
        <h2 className="text-2xl font-black text-slate-900 mb-3">도움 요청을 받았어요</h2>
        <p className="text-base text-slate-600 leading-relaxed mb-8">
          담당자가 확인 후 연락드릴게요.<br />
          {wantContact ? '입력하신 번호로 연락드려요.' : '익명으로 접수되었어요.'}
        </p>
        <button
          type="button"
          onClick={() => { setSubmitted(false); setSelectedType(null); setContent(''); setPhone(''); setWantContact(false); }}
          className="bg-teal-600 hover:bg-teal-700 text-white font-black text-lg px-8 py-4 rounded-2xl"
        >
          처음으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 pb-10">
      <div className="bg-white px-5 pt-5 pb-5 border-b border-slate-100 shadow-sm">
        <h1 className="text-xl font-black text-slate-900">어떤 도움이 필요하세요?</h1>
        <p className="text-sm text-slate-500 mt-1">아래에서 선택하고 내용을 적어주세요.</p>
      </div>

      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">
        {/* 도움 유형 선택 */}
        <div className="space-y-2">
          {HELP_TYPES.map(({ label, emoji }) => (
            <button
              key={label}
              type="button"
              onClick={() => setSelectedType(label)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-left transition-colors ${
                selectedType === label
                  ? 'border-teal-500 bg-teal-50 text-teal-800'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="text-2xl">{emoji}</span>
              <span className="text-lg font-bold">{label}</span>
              {selectedType === label && (
                <span className="ml-auto text-teal-500">
                  <CheckCircle size={22} />
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 내용 입력 */}
        <div>
          <label htmlFor="help-content" className="block text-base font-black text-slate-900 mb-2">
            필요한 내용을 적어주세요
          </label>
          <textarea
            id="help-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="예: 이번 주에 먹을 식료품이 없어요. 도움을 받을 수 있을까요?"
            rows={5}
            className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-4 text-base text-slate-900 placeholder-slate-400 focus:border-teal-500 outline-none resize-none transition-colors"
          />
        </div>

        {/* 연락처 (선택) */}
        <div className="bg-white rounded-2xl p-4 border-2 border-slate-200 space-y-3">
          <button
            type="button"
            onClick={() => setWantContact((v) => !v)}
            className={`w-full flex items-center gap-3 text-left ${wantContact ? 'text-teal-700' : 'text-slate-700'}`}
          >
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${wantContact ? 'border-teal-500 bg-teal-500' : 'border-slate-300 bg-white'}`}>
              {wantContact && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
            </div>
            <span className="text-base font-bold">연락을 받고 싶어요 (선택사항)</span>
          </button>

          {wantContact && (
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="전화번호 (예: 010-1234-5678)"
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-base text-slate-900 placeholder-slate-400 focus:border-teal-500 outline-none transition-colors"
            />
          )}
        </div>

        <p className="text-sm text-slate-400 text-center">
          연락처를 입력하지 않으면 익명으로 접수돼요.
        </p>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xl py-5 rounded-2xl transition-colors shadow"
        >
          도움 요청 보내기
        </button>
      </form>
    </div>
  );
}
