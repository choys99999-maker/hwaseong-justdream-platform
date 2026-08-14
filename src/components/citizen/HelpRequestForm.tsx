import { useState } from 'react';
import { createHelpRequest, type HelpRequestChannel, type HelpRequestType } from '../../store/helpRequests';
import { AREA_LIST } from '../../data/mockSites';
import type { ItemCategory } from '../../types';
import Button from './ui/Button';
import { ChoiceGroup, Field, Select, TextInput, Textarea } from './ui/Form';
import { DonePanel, ErrorNote } from './ui/Feedback';

const REQUEST_TYPES: { value: HelpRequestType; label: string }[] = [
  { value: 'SELF', label: '직접 갈 수 있어요' },
  { value: 'DELIVERY', label: '가져다주세요' },
];

/** 관리자 전화 대리 접수는 들어온 말을 그대로 분류할 수 있게 5종을 전부 쓴다. */
const ADMIN_CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: '식품', label: '식품' },
  { value: '위생용품', label: '위생용품' },
  { value: '생필품', label: '생필품' },
  { value: '영유아용품', label: '영유아용품' },
  { value: '기타', label: '기타' },
];

/**
 * 시민이 직접 고를 때는 3개면 충분하다. 저장되는 값은 기존 ItemCategory 그대로이고
 * (스키마를 건드리지 않는다) 화면에 보이는 말만 시민 언어로 바꾼다.
 */
const CITIZEN_CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: '식품', label: '먹거리' },
  { value: '생필품', label: '생활용품' },
  { value: '기타', label: '기타' },
];

interface HelpRequestFormProps {
  channel: HelpRequestChannel;
  /** `citizen` 은 시민 순서(무엇 → 어디 → 번호 → 전달)와 3종 선택지를 쓴다. */
  variant?: 'admin' | 'citizen';
  doneLinkTo?: string;
  doneLinkLabel?: string;
  /** 지도 위 시트처럼 이미 화면 안에 있는 경우, 완료 후 링크 대신 이 동작을 쓴다. */
  onDone?: () => void;
  onSubmitted?: () => void;
}

/**
 * 도움 요청 입력.
 *
 * 시민 자가 입력과 관리자 전화 대리 입력이 이 하나를 같이 쓴다 — 순서와 문구만 variant 로
 * 갈리고 저장은 `createHelpRequest` 한 곳으로 모인다.
 *
 * 시민 화면에서는 §최소 입력 원칙에 따라 네 가지만 묻는다.
 *   무엇이 필요한지 · 사는 동네 · 연락받을 번호 · 직접 갈 수 있는지
 * 이름·주민번호·소득 증명·사유서는 묻지 않는다. 자격을 확인하는 화면이 아니다.
 */
export default function HelpRequestForm({
  channel,
  variant = 'admin',
  doneLinkTo = '/',
  doneLinkLabel = '지도로 돌아가기',
  onDone,
  onSubmitted,
}: HelpRequestFormProps) {
  const isCitizen = variant === 'citizen';
  const categories = isCitizen ? CITIZEN_CATEGORIES : ADMIN_CATEGORIES;

  const [phone, setPhone] = useState('');
  const [dong, setDong] = useState('');
  const [itemCategory, setItemCategory] = useState<ItemCategory | null>(null);
  const [requestType, setRequestType] = useState<HelpRequestType | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit =
    phone.trim().length > 0 &&
    dong.trim().length > 0 &&
    itemCategory !== null &&
    (!isCitizen || requestType !== null) &&
    !submitting;

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
        requestType: requestType ?? undefined,
      });
      setDone(true);
      onSubmitted?.();
    } catch (err) {
      // 사용자에게는 다음에 할 일만 말한다. 원인(중앙 저장소 미설정·네트워크)은 콘솔에만 남긴다.
      console.error('[HelpRequestForm]', err);
      setError('요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <DonePanel title="요청을 보냈어요" description="담당자가 확인하고 알려주신 번호로 연락드릴게요.">
        {onDone ? (
          <Button variant="secondary" onClick={onDone}>
            {doneLinkLabel}
          </Button>
        ) : (
          <Button variant="secondary" to={doneLinkTo}>
            {doneLinkLabel}
          </Button>
        )}
      </DonePanel>
    );
  }

  const categoryField = (
    <ChoiceGroup
      label={isCitizen ? '무엇이 필요하세요?' : '필요한 물품 종류'}
      choices={categories}
      value={itemCategory}
      onChange={setItemCategory}
      columns={isCitizen ? 3 : 2}
    />
  );

  const dongField = (
    <Field label={isCitizen ? '사는 동네' : '사는 읍면동'} htmlFor="help-dong">
      <Select id="help-dong" value={dong} onChange={(e) => setDong(e.target.value)}>
        <option value="">선택해 주세요</option>
        {AREA_LIST.map((area) => (
          <option key={area.area} value={area.area}>
            {area.area}
          </option>
        ))}
      </Select>
    </Field>
  );

  const phoneField = (
    <Field label="연락받을 번호" htmlFor="help-phone">
      <TextInput
        id="help-phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="010-0000-0000"
      />
    </Field>
  );

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${isCitizen ? '' : 'px-4 py-5'}`}>
      {isCitizen ? (
        <>
          {categoryField}
          {dongField}
          {phoneField}
          <ChoiceGroup
            label="직접 가실 수 있나요?"
            choices={REQUEST_TYPES}
            value={requestType}
            onChange={setRequestType}
          />
        </>
      ) : (
        <>
          {phoneField}
          {dongField}
          {categoryField}
          <Field label="전달할 말" htmlFor="help-message" optional>
            <Textarea
              id="help-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </Field>
        </>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      <Button type="submit" disabled={!canSubmit}>
        {submitting ? '보내는 중이에요' : '도움 요청 보내기'}
      </Button>
    </form>
  );
}
