import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { createHelpRequest, type HelpRequestChannel } from '../../store/helpRequests';
import { AREA_LIST } from '../../data/mockSites';
import type { ItemCategory } from '../../types';
import BigButton from './BigButton';

const ITEM_CATEGORIES: ItemCategory[] = ['식품', '위생용품', '생필품', '영유아용품', '기타'];

interface HelpRequestFormProps {
  channel: HelpRequestChannel;
  /** 완료 후 "처음으로" 버튼이 갈 위치. 시민 화면은 홈, 관리자 화면은 목록으로 다르다. */
  doneLinkTo?: string;
  doneLinkLabel?: string;
  onSubmitted?: () => void;
}

/**
 * 도움 요청 입력 폼. 시민 `/help` 자가 입력과 관리자 전화 대리 입력이 이 컴포넌트 하나를 같이 쓴다 —
 * channel 값만 다르고 저장은 같은 `createHelpRequest` 호출 한 곳으로 모인다.
 * 필수 입력만 받는다(주민번호·소득 증명·긴 사유서는 요구하지 않는다).
 */
export default function HelpRequestForm({
  channel,
  doneLinkTo = '/',
  doneLinkLabel = '처음으로',
  onSubmitted,
}: HelpRequestFormProps) {
  const [phone, setPhone] = useState('');
  const [dong, setDong] = useState('');
  const [itemCategory, setItemCategory] = useState<ItemCategory | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = phone.trim().length > 0 && dong.trim().length > 0 && itemCategory !== null && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !itemCategory) return;
    setSubmitting(true);
    setError(null);
    try {
      await createHelpRequest({
        phone: phone.trim(),
        dong,
        itemCategory,
        message: message.trim() || undefined,
        channel,
      });
      setDone(true);
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-600">
          <CheckCircle2 size={36} />
        </span>
        <h2 className="text-2xl font-bold text-slate-900">요청이 접수되었습니다.</h2>
        <p className="text-lg text-slate-600">담당자가 확인 후 연락드릴게요.</p>
        <div className="mt-4 w-full max-w-xs">
          <BigButton to={doneLinkTo} variant="secondary">
            {doneLinkLabel}
          </BigButton>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 px-4 py-5">
      <div>
        <label htmlFor="help-phone" className="mb-2 block text-lg font-bold text-slate-800">
          연락 가능한 번호
        </label>
        <input
          id="help-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="010-0000-0000"
          className="w-full rounded-xl border-2 border-slate-300 px-4 py-3.5 text-lg text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/20"
        />
      </div>

      <div>
        <label htmlFor="help-dong" className="mb-2 block text-lg font-bold text-slate-800">
          사는 읍면동
        </label>
        <select
          id="help-dong"
          value={dong}
          onChange={(e) => setDong(e.target.value)}
          className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3.5 text-lg text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/20"
        >
          <option value="">선택해 주세요</option>
          {AREA_LIST.map((area) => (
            <option key={area.area} value={area.area}>
              {area.area}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-2 text-lg font-bold text-slate-800">필요한 물품 종류</p>
        <div className="grid grid-cols-2 gap-2.5">
          {ITEM_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setItemCategory(cat)}
              aria-pressed={itemCategory === cat}
              className={`min-h-[52px] rounded-xl border-2 px-3 py-3 text-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/40 ${
                itemCategory === cat
                  ? 'border-teal-600 bg-teal-50 text-teal-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-teal-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="help-message" className="mb-2 block text-lg font-bold text-slate-800">
          전달할 말 <span className="text-base font-normal text-slate-400">(선택)</span>
        </label>
        <textarea
          id="help-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full rounded-xl border-2 border-slate-300 px-4 py-3.5 text-lg text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/20"
        />
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-base text-rose-700">{error}</p>}

      <BigButton type="submit" disabled={!canSubmit}>
        {submitting ? '접수하는 중...' : '요청 보내기'}
      </BigButton>
    </form>
  );
}
