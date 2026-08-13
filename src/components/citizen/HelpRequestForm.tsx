import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { createHelpRequest, type HelpRequestChannel } from '../../store/helpRequests';
import { AREA_LIST } from '../../data/mockSites';
import type { ItemCategory } from '../../types';
import BigButton from './BigButton';

/** 관리자 전화 대리 접수는 들어온 말을 그대로 분류할 수 있게 5종을 전부 쓴다. */
const ADMIN_CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: '식품', label: '식품' },
  { value: '위생용품', label: '위생용품' },
  { value: '생필품', label: '생필품' },
  { value: '영유아용품', label: '영유아용품' },
  { value: '기타', label: '기타' },
];

/**
 * 시민이 직접 고를 때는 3개면 충분하다. 값 자체는 기존 ItemCategory 를 그대로 쓰고
 * (저장 스키마를 건드리지 않는다) 화면에 보이는 말만 시민 언어로 바꾼다.
 */
const CITIZEN_CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: '식품', label: '먹거리' },
  { value: '생필품', label: '생활용품' },
  { value: '기타', label: '기타' },
];

interface HelpRequestFormProps {
  channel: HelpRequestChannel;
  /** `citizen` 은 시민 모바일 순서(무엇 → 어디 → 번호)와 3종 선택지를 쓴다. */
  variant?: 'admin' | 'citizen';
  /** 완료 후 "처음으로" 버튼이 갈 위치. 시민 화면은 홈, 관리자 화면은 목록으로 다르다. */
  doneLinkTo?: string;
  doneLinkLabel?: string;
  /** 지도 위 시트처럼 이미 화면 안에 있는 경우, 완료 후 링크 대신 이 동작을 쓴다. */
  onDone?: () => void;
  onSubmitted?: () => void;
}

/**
 * 도움 요청 입력 폼. 시민 자가 입력과 관리자 전화 대리 입력이 이 컴포넌트 하나를 같이 쓴다 —
 * 순서와 선택지 문구만 variant 로 갈리고 저장은 같은 `createHelpRequest` 호출 한 곳으로 모인다.
 * 필수 입력만 받는다(이름·주민번호·소득 증명·긴 사유서는 요구하지 않는다).
 */
export default function HelpRequestForm({
  channel,
  variant = 'admin',
  doneLinkTo = '/',
  doneLinkLabel = '처음으로',
  onDone,
  onSubmitted,
}: HelpRequestFormProps) {
  const [phone, setPhone] = useState('');
  const [dong, setDong] = useState('');
  const [itemCategory, setItemCategory] = useState<ItemCategory | null>(null);
  const [message, setMessage] = useState('');
  const [showMessage, setShowMessage] = useState(variant === 'admin');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isCitizen = variant === 'citizen';
  const categories = isCitizen ? CITIZEN_CATEGORIES : ADMIN_CATEGORIES;
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
      <div className={`flex flex-col items-center gap-3 text-center ${isCitizen ? 'px-2 py-8' : 'px-4 py-16'}`}>
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-600">
          <CheckCircle2 size={36} aria-hidden />
        </span>
        <h2 className="text-2xl font-bold text-slate-900">요청이 접수되었습니다.</h2>
        <p className="text-lg text-slate-600">담당자가 확인 후 연락드릴게요.</p>
        <div className="mt-4 w-full max-w-xs">
          {onDone ? (
            <BigButton variant="secondary" onClick={onDone}>
              {doneLinkLabel}
            </BigButton>
          ) : (
            <BigButton to={doneLinkTo} variant="secondary">
              {doneLinkLabel}
            </BigButton>
          )}
        </div>
      </div>
    );
  }

  const categoryField = (
    <div>
      <p className="mb-2 text-lg font-bold text-slate-800">{isCitizen ? '무엇이 필요하세요?' : '필요한 물품 종류'}</p>
      <div className={`grid gap-2.5 ${isCitizen ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {categories.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => setItemCategory(cat.value)}
            aria-pressed={itemCategory === cat.value}
            className={`min-h-[56px] rounded-xl border-2 px-2 py-3 text-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/40 ${
              itemCategory === cat.value
                ? 'border-teal-600 bg-teal-50 text-teal-800'
                : 'border-slate-200 bg-white text-slate-700 hover:border-teal-400'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );

  const dongField = (
    <div>
      <label htmlFor="help-dong" className="mb-2 block text-lg font-bold text-slate-800">
        {isCitizen ? '어디에 사세요?' : '사는 읍면동'}
      </label>
      <select
        id="help-dong"
        value={dong}
        onChange={(e) => setDong(e.target.value)}
        className="min-h-[56px] w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3.5 text-lg text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/20"
      >
        <option value="">선택해 주세요</option>
        {AREA_LIST.map((area) => (
          <option key={area.area} value={area.area}>
            {area.area}
          </option>
        ))}
      </select>
    </div>
  );

  const phoneField = (
    <div>
      <label htmlFor="help-phone" className="mb-2 block text-lg font-bold text-slate-800">
        {isCitizen ? '연락받을 번호' : '연락 가능한 번호'}
      </label>
      <input
        id="help-phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="010-0000-0000"
        className="min-h-[56px] w-full rounded-xl border-2 border-slate-300 px-4 py-3.5 text-lg text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/20"
      />
    </div>
  );

  const messageField = showMessage ? (
    <div>
      <label htmlFor="help-message" className="mb-2 block text-lg font-bold text-slate-800">
        전달할 말 <span className="text-base font-normal text-slate-400">(선택)</span>
      </label>
      <textarea
        id="help-message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        autoFocus={isCitizen}
        className="w-full rounded-xl border-2 border-slate-300 px-4 py-3.5 text-lg text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/20"
      />
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setShowMessage(true)}
      className="min-h-[48px] w-full rounded-xl border-2 border-dashed border-slate-200 text-lg font-medium text-slate-500 hover:border-teal-400 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/40"
    >
      전달할 말이 있어요
    </button>
  );

  return (
    <form onSubmit={handleSubmit} className={`space-y-5 ${isCitizen ? 'pb-2' : 'px-4 py-5'}`}>
      {isCitizen ? (
        <>
          {categoryField}
          {dongField}
          {phoneField}
          {messageField}
        </>
      ) : (
        <>
          {phoneField}
          {dongField}
          {categoryField}
          {messageField}
        </>
      )}

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-base text-rose-700">{error}</p>}

      <BigButton type="submit" disabled={!canSubmit}>
        {submitting ? '접수하는 중...' : isCitizen ? '도움 요청하기' : '요청 보내기'}
      </BigButton>
    </form>
  );
}
