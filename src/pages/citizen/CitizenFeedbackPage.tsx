import { useState } from 'react';
import AppHeader from '../../components/citizen/ui/AppHeader';
import Button from '../../components/citizen/ui/Button';
import { Checkbox, Field, TextInput, Textarea } from '../../components/citizen/ui/Form';
import { DonePanel, ErrorNote } from '../../components/citizen/ui/Feedback';
import { createFeedback } from '../../store/feedback';

/**
 * 말 남기기. 화면에 있는 것은 글 쓰는 칸 하나, 체크 하나, 버튼 하나다.
 * 익명이 기본이고, 답변을 원한다고 체크했을 때만 연락처 칸이 나타난다 —
 * 처음부터 번호를 물으면 "이름·번호를 대야 하는 민원 창구" 처럼 읽힌다.
 */
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
      console.error('[CitizenFeedbackPage]', err);
      setError('보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <>
        <AppHeader title="말 남기기" backTo="/" />
        <DonePanel title="남겨주셔서 고맙습니다" />
      </>
    );
  }

  return (
    <>
      <AppHeader title="말 남기기" />
      <div className="px-5 py-6 pb-[max(32px,env(safe-area-inset-bottom))]">
        <h2 className="text-title text-ink-950">말만 남겨도 돼요</h2>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <Textarea
            aria-label="하고 싶은 말"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={7}
            placeholder="하고 싶은 말을 편하게 남겨 주세요"
          />

          <Checkbox checked={wantsReply} onChange={setWantsReply}>
            답변을 받고 싶어요
          </Checkbox>

          {wantsReply && (
            <Field label="연락받을 번호" htmlFor="feedback-contact">
              <TextInput
                id="feedback-contact"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="010-0000-0000"
              />
            </Field>
          )}

          {error && <ErrorNote>{error}</ErrorNote>}

          <Button type="submit" disabled={!canSubmit}>
            {submitting ? '보내는 중이에요' : '남기기'}
          </Button>
        </form>
      </div>
    </>
  );
}
