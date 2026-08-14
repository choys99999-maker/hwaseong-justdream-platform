import { useState } from 'react';
import { Globe } from 'lucide-react';
import AppHeader from '../../components/citizen/ui/AppHeader';
import Button from '../../components/citizen/ui/Button';
import { ChoiceGroup, Field, Select, TextInput, Textarea } from '../../components/citizen/ui/Form';
import { DonePanel, ErrorNote } from '../../components/citizen/ui/Feedback';
import { createHelpRequest } from '../../store/helpRequests';
import { AREA_LIST } from '../../data/mockSites';
import type { ItemCategory } from '../../types';

// ── 언어 ──────────────────────────────────────────────────────────
//
// 화성시는 외국인 주민 비율이 높다. 직접 방문이 어려운 분일수록 한국어 안내만으로는
// 신청 자체를 포기하기 쉬워서, 이 화면만큼은 4개 언어를 그대로 담았다.
// (전체 앱 i18n 은 아직 없다 — 필요해지면 이 사전을 공용 모듈로 올린다.)

type Lang = 'ko' | 'en' | 'zh' | 'vi';

const LANGS: { value: Lang; label: string }[] = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'vi', label: 'Tiếng Việt' },
];

interface Copy {
  title: string;
  heroTitle: string;
  heroDesc: string;
  langLabel: string;
  name: string;
  namePh: string;
  phone: string;
  dong: string;
  dongPh: string;
  address: string;
  addressPh: string;
  dropoff: string;
  dropoffOpts: string[];
  category: string;
  categoryOpts: string[];
  time: string;
  timeOpts: string[];
  message: string;
  messagePh: string;
  optional: string;
  submit: string;
  submitting: string;
  doneTitle: string;
  doneDesc: string;
  doneBack: string;
  privacy: string;
}

const COPY: Record<Lang, Copy> = {
  ko: {
    title: '찾아가서드림',
    heroTitle: '못 오시면, 저희가 갑니다',
    heroDesc: '오기 어려우시면 알려주세요. 담당자가 확인하고 물품을 가져다드려요.',
    langLabel: '언어 선택 / Language',
    name: '이름',
    namePh: '예: 홍길동',
    phone: '연락처',
    dong: '사는 동네',
    dongPh: '선택해 주세요',
    address: '상세 주소',
    addressPh: '예: ○○아파트 101동 202호',
    dropoff: '어디로 가져다드릴까요?',
    dropoffOpts: ['집 앞에 두기', '경비실·택배함', '직접 만나서 받기', '그 밖에 (아래에 적어주세요)'],
    category: '무엇이 필요하세요?',
    categoryOpts: ['먹거리', '생활용품', '위생용품', '영유아용품', '그 밖에'],
    time: '언제가 편하세요?',
    timeOpts: ['오전 (9시~12시)', '오후 (12시~6시)', '아무 때나 괜찮아요'],
    message: '전할 말',
    messagePh: '예: 문 앞에 두고 벨 눌러주세요',
    optional: '선택',
    submit: '신청 보내기',
    submitting: '보내는 중이에요',
    doneTitle: '신청을 보냈어요',
    doneDesc: '담당자가 확인하고 알려주신 번호로 연락드릴게요.',
    doneBack: '지도로 돌아가기',
    privacy: '알려주신 정보는 물품을 전해드리는 데에만 씁니다.',
  },
  en: {
    title: 'Home Delivery',
    heroTitle: "Can't come? We'll come to you",
    heroDesc: 'If it is hard to visit in person, let us know. Our staff will check and bring the goods to you.',
    langLabel: '언어 선택 / Language',
    name: 'Name',
    namePh: 'e.g. John Smith',
    phone: 'Phone number',
    dong: 'Your neighborhood',
    dongPh: 'Please select',
    address: 'Detailed address',
    addressPh: 'e.g. Apt 101, Unit 202',
    dropoff: 'Where should we deliver?',
    dropoffOpts: ['Leave at my door', 'Security office / parcel box', 'Hand it to me in person', 'Other (write below)'],
    category: 'What do you need?',
    categoryOpts: ['Food', 'Household goods', 'Hygiene goods', 'Baby supplies', 'Other'],
    time: 'When is convenient?',
    timeOpts: ['Morning (9am–12pm)', 'Afternoon (12pm–6pm)', 'Anytime is fine'],
    message: 'Message',
    messagePh: 'e.g. please ring the bell after leaving it',
    optional: 'optional',
    submit: 'Send request',
    submitting: 'Sending',
    doneTitle: 'Your request was sent',
    doneDesc: 'Our staff will review it and contact you at the number you provided.',
    doneBack: 'Back to map',
    privacy: 'Your information is used only for delivering the goods.',
  },
  zh: {
    title: '上门配送',
    heroTitle: '您来不了，我们送上门',
    heroDesc: '如果难以亲自前来，请告诉我们。工作人员确认后会为您送货上门。',
    langLabel: '언어 선택 / Language',
    name: '姓名',
    namePh: '例：张三',
    phone: '联系电话',
    dong: '居住地区',
    dongPh: '请选择',
    address: '详细地址',
    addressPh: '例：○○公寓 101栋 202室',
    dropoff: '送到哪里？',
    dropoffOpts: ['放在门口', '保安室 / 快递柜', '当面交给我', '其他（请在下方填写）'],
    category: '您需要什么？',
    categoryOpts: ['食品', '生活用品', '卫生用品', '婴幼儿用品', '其他'],
    time: '什么时间方便？',
    timeOpts: ['上午（9点–12点）', '下午（12点–6点）', '任何时间都可以'],
    message: '留言',
    messagePh: '例：请放门口后按门铃',
    optional: '选填',
    submit: '提交申请',
    submitting: '发送中',
    doneTitle: '申请已送出',
    doneDesc: '工作人员确认后会拨打您留下的电话联系您。',
    doneBack: '返回地图',
    privacy: '您填写的信息仅用于物品配送。',
  },
  vi: {
    title: 'Giao hàng tận nhà',
    heroTitle: 'Bạn không đến được? Chúng tôi sẽ đến',
    heroDesc: 'Nếu bạn khó đến trực tiếp, hãy cho chúng tôi biết. Nhân viên sẽ xác nhận và mang hàng đến cho bạn.',
    langLabel: '언어 선택 / Language',
    name: 'Họ và tên',
    namePh: 'VD: Nguyễn Văn A',
    phone: 'Số điện thoại',
    dong: 'Khu vực bạn sống',
    dongPh: 'Vui lòng chọn',
    address: 'Địa chỉ chi tiết',
    addressPh: 'VD: Chung cư ○○, tòa 101, phòng 202',
    dropoff: 'Giao đến đâu?',
    dropoffOpts: ['Để trước cửa nhà', 'Phòng bảo vệ / tủ giao hàng', 'Giao trực tiếp cho tôi', 'Khác (ghi bên dưới)'],
    category: 'Bạn cần gì?',
    categoryOpts: ['Thực phẩm', 'Đồ dùng sinh hoạt', 'Đồ vệ sinh', 'Đồ cho trẻ nhỏ', 'Khác'],
    time: 'Khi nào thuận tiện?',
    timeOpts: ['Buổi sáng (9h–12h)', 'Buổi chiều (12h–18h)', 'Lúc nào cũng được'],
    message: 'Lời nhắn',
    messagePh: 'VD: xin bấm chuông sau khi để hàng',
    optional: 'tùy chọn',
    submit: 'Gửi đăng ký',
    submitting: 'Đang gửi',
    doneTitle: 'Đã gửi đăng ký',
    doneDesc: 'Nhân viên sẽ kiểm tra và liên hệ với bạn qua số điện thoại đã cung cấp.',
    doneBack: 'Quay lại bản đồ',
    privacy: 'Thông tin của bạn chỉ được dùng cho mục đích giao hàng.',
  },
};

/** 저장 스키마의 ItemCategory 와 화면 선택지의 순서를 맞춘 값. 라벨만 언어별로 갈린다. */
const CATEGORY_VALUES: ItemCategory[] = ['식품', '생필품', '위생용품', '영유아용품', '기타'];

/** 관리자 화면에 그대로 남는 한국어 기준값 — 담당자가 읽을 말이므로 번역하지 않는다. */
const DROPOFF_KO = ['집 앞에 두기', '경비실·택배함', '직접 만나서 받기', '기타'];
const TIME_KO = ['오전 (9시~12시)', '오후 (12시~6시)', '아무 때나'];

/** 인덱스 선택지를 공용 ChoiceGroup(문자열 값)에 맞추기 위한 변환. */
function indexed(options: string[]) {
  return options.map((label, i) => ({ value: String(i), label }));
}

/**
 * 찾아가서드림.
 *
 * 직접 올 수 없는 분을 위한 신청이라 물어야 할 것이 도움 요청보다 많다 —
 * 대신 한 칸에 하나씩만 묻고, 필수/선택 알약을 모든 칸에 달지 않는다(선택 항목에만 적는다).
 */
export default function DeliveryRequestPage() {
  const [lang, setLang] = useState<Lang>('ko');
  const t = COPY[lang];

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dong, setDong] = useState('');
  const [address, setAddress] = useState('');
  const [dropoff, setDropoff] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit =
    name.trim().length > 0 &&
    phone.trim().length > 0 &&
    dong.length > 0 &&
    address.trim().length > 0 &&
    dropoff !== null &&
    category !== null &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || category === null || dropoff === null) return;

    setSubmitting(true);
    setError(null);
    try {
      /*
       * 백엔드 RPC(create_help_request)는 고정 필드만 받는다.
       * 이름·상세주소·전달 위치·희망 시간·신청 언어는 컬럼이 없으므로 message 에
       * 사람이 읽는 형태로 담는다 — 관리자 스키마를 건드리지 않기 위한 선택이다.
       */
      const lines = [
        '[찾아가서드림 신청]',
        `이름: ${name.trim()}`,
        `상세주소: ${address.trim()}`,
        `전달 위치: ${DROPOFF_KO[Number(dropoff)]}`,
        time !== null ? `희망 시간: ${TIME_KO[Number(time)]}` : null,
        lang !== 'ko' ? `신청 언어: ${LANGS.find((l) => l.value === lang)?.label}` : null,
        message.trim() ? `남긴 말: ${message.trim()}` : null,
      ].filter(Boolean);

      await createHelpRequest({
        phone: phone.trim(),
        dong,
        itemCategory: CATEGORY_VALUES[Number(category)],
        message: lines.join('\n'),
        channel: 'CITIZEN',
        requestType: 'DELIVERY',
      });
      setDone(true);
    } catch (err) {
      console.error('[DeliveryRequestPage]', err);
      setError('보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <>
        <AppHeader title={t.title} backTo="/" />
        <DonePanel title={t.doneTitle} description={t.doneDesc}>
          <Button to="/" variant="secondary">
            {t.doneBack}
          </Button>
        </DonePanel>
      </>
    );
  }

  return (
    <>
      <AppHeader title={t.title} />
      <div className="px-5 py-6 pb-[max(32px,env(safe-area-inset-bottom))]">
        <h2 className="text-title text-ink-950">{t.heroTitle}</h2>
        <p className="mt-2 text-body text-ink-600">{t.heroDesc}</p>

        <div className="mt-5">
          <p className="mb-2 flex items-center gap-1.5 text-note font-semibold text-ink-600">
            <Globe size={16} aria-hidden />
            {t.langLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            {LANGS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLang(l.value)}
                aria-pressed={lang === l.value}
                className={`tap-md rounded-full border px-4 text-note font-semibold transition-colors focus-ring ${
                  lang === l.value
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-line-200 bg-surface text-ink-800 hover:border-brand-300'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-6">
          <Field label={t.name} htmlFor="delivery-name">
            <TextInput
              id="delivery-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePh}
            />
          </Field>

          <Field label={t.phone} htmlFor="delivery-phone">
            <TextInput
              id="delivery-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
            />
          </Field>

          <Field label={t.dong} htmlFor="delivery-dong">
            <Select id="delivery-dong" value={dong} onChange={(e) => setDong(e.target.value)}>
              <option value="">{t.dongPh}</option>
              {AREA_LIST.map((a) => (
                <option key={a.area} value={a.area}>
                  {a.area}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t.address} htmlFor="delivery-address">
            <TextInput
              id="delivery-address"
              type="text"
              autoComplete="street-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t.addressPh}
            />
          </Field>

          <ChoiceGroup label={t.dropoff} choices={indexed(t.dropoffOpts)} value={dropoff} onChange={setDropoff} />

          <ChoiceGroup
            label={t.category}
            choices={indexed(t.categoryOpts)}
            value={category}
            onChange={setCategory}
            columns={2}
          />

          <ChoiceGroup
            label={`${t.time} (${t.optional})`}
            choices={indexed(t.timeOpts)}
            value={time}
            onChange={setTime}
          />

          <Field label={`${t.message} (${t.optional})`} htmlFor="delivery-message">
            <Textarea
              id="delivery-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.messagePh}
            />
          </Field>

          {error && <ErrorNote>{error}</ErrorNote>}

          <p className="text-note text-ink-600">{t.privacy}</p>

          <Button type="submit" disabled={!canSubmit}>
            {submitting ? t.submitting : t.submit}
          </Button>
        </form>
      </div>
    </>
  );
}
