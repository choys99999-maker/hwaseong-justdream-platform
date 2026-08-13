import { useState } from 'react';
import { CheckCircle, MessageSquare } from 'lucide-react';

const SUGGESTIONS = [
  '필요한 물품이 없었어요.',
  '이런 물품도 있었으면 좋겠어요.',
  '찾기 어려웠어요.',
  '운영시간이 짧아요.',
  '감사해요, 잘 이용했어요!',
];

export default function FeedbackPage() {
  const [text, setText] = useState('');
  const [wantContact, setWantContact] = useState(false);
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = text.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    console.log({ text, phone: wantContact ? phone : '익명' });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 text-center">
        <CheckCircle size={72} className="text-teal-500 mb-5" />
        <h2 className="text-2xl font-black text-slate-900 mb-3">말씀 남겨주셔서 감사해요</h2>
        <p className="text-base text-slate-600 leading-relaxed mb-8">
          소중한 의견을 잘 받았어요.<br />
          더 좋은 서비스를 만드는 데 활용할게요.
        </p>
        <button
          type="button"
          onClick={() => { setSubmitted(false); setText(''); setWantContact(false); setPhone(''); }}
          className="bg-teal-600 hover:bg-teal-700 text-white font-black text-lg px-8 py-4 rounded-2xl"
        >
          또 남기기
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 pb-10">
      <div className="bg-white px-5 pt-5 pb-5 border-b border-slate-100 shadow-sm">
        <h1 className="text-xl font-black text-slate-900">말 남기기</h1>
        <p className="text-sm text-slate-500 mt-1">이용하신 느낌을 자유롭게 적어주세요. 익명이에요.</p>
      </div>

      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">
        {/* 추천 문구 */}
        <div>
          <p className="text-sm font-bold text-slate-500 mb-2">빠르게 선택하려면 아래를 눌러보세요</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setText(s)}
                className={`px-3 py-2 rounded-full border-2 text-sm font-medium transition-colors ${
                  text === s
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 직접 입력 */}
        <div>
          <label htmlFor="feedback-text" className="block text-base font-black text-slate-900 mb-2">
            <MessageSquare className="inline mr-1.5 -mt-0.5" size={18} />
            직접 입력하기
          </label>
          <textarea
            id="feedback-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="자유롭게 의견을 남겨주세요."
            rows={5}
            className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-4 text-base text-slate-900 placeholder-slate-400 focus:border-teal-500 outline-none resize-none transition-colors"
          />
          <p className="text-xs text-slate-400 mt-1 text-right">{text.length}자</p>
        </div>

        {/* 연락처 선택 */}
        <div className="bg-white rounded-2xl p-4 border-2 border-slate-200 space-y-3">
          <button
            type="button"
            onClick={() => setWantContact((v) => !v)}
            className={`w-full flex items-center gap-3 text-left ${wantContact ? 'text-teal-700' : 'text-slate-700'}`}
          >
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${wantContact ? 'border-teal-500 bg-teal-500' : 'border-slate-300 bg-white'}`}>
              {wantContact && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
            </div>
            <span className="text-base font-bold">연락을 받아보고 싶어요 (선택사항)</span>
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
          연락처를 입력하지 않으면 완전히 익명으로 처리돼요.
        </p>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xl py-5 rounded-2xl transition-colors shadow"
        >
          익명으로 남기기
        </button>
      </form>
    </div>
  );
}
