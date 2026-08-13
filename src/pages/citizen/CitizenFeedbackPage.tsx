import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import CitizenPageHeader from '../../components/citizen/CitizenPageHeader';
import BigButton from '../../components/citizen/BigButton';
import { createFeedback } from '../../store/feedback';

/** "말만 남겨도 돼요" — textarea 하나. 익명이 기본이고, 답변을 원할 때만 연락처를 보여준다. */
export default function CitizenFeedbackPage() {
  const [message, setMessage] = useState('');
  const [wantsReply, setWantsReply] = useState(false);
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = message.trim().length > 0 && (!wantsReply || contact.trim().length > 0) && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createFeedback({
        message: message.trim(),
        anonymous: !wantsReply,
        contact: wantsReply ? contact.trim() : undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '전송에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-600">
          <CheckCircle2 size={36} aria-hidden />
        </span>
        <h1 className="text-2xl font-bold text-slate-900">말씀 남겨주셔서 감사해요.</h1>
        <div className="mt-4 w-full max-w-xs">
          <BigButton to="/" variant="secondary">
            지도로 돌아가기
          </BigButton>
        </div>
      </div>
    );
  }

  return (
    <div className="px-0 pb-[max(40px,env(safe-area-inset-bottom))]">
      <CitizenPageHeader title="말만 남겨도 돼요" />

      <form onSubmit={handleSubmit} className="mt-5 space-y-5 px-5">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          autoFocus
          placeholder="하고 싶은 말을 편하게 남겨 주세요"
          className="w-full rounded-xl border-2 border-slate-300 px-4 py-3.5 text-lg text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/20"
        />

        <label className="flex min-h-[48px] items-center gap-3 text-lg font-medium text-slate-800">
          <input
            type="checkbox"
            checked={wantsReply}
            onChange={(e) => setWantsReply(e.target.checked)}
            className="h-6 w-6 shrink-0 rounded border-2 border-slate-300 text-teal-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/40"
          />
          답변을 받고 싶어요
        </label>

        {wantsReply && (
          <div>
            <label htmlFor="feedback-contact" className="mb-2 block text-lg font-bold text-slate-800">
              연락받을 번호
            </label>
            <input
              id="feedback-contact"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="010-0000-0000"
              className="min-h-[56px] w-full rounded-xl border-2 border-slate-300 px-4 py-3.5 text-lg text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/20"
            />
          </div>
        )}

        {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-base text-rose-700">{error}</p>}

        <BigButton type="submit" disabled={!canSubmit}>
          {submitting ? '보내는 중...' : '남기기'}
        </BigButton>
      </form>
    </div>
  );
}
