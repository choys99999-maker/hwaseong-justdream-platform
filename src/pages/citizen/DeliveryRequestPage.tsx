import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Globe, HandHeart } from 'lucide-react';
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
  back: string;
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
  required: string;
  submit: string;
  submitting: string;
  doneTitle: string;
  doneDesc: string;
  doneBack: string;
  privacy: string;
}

const COPY: Record<Lang, Copy> = {
  ko: {
    back: '지도로 돌아가기',
    title: '찾아가서드림',
    heroTitle: '못 오시면, 저희가 갑니다',
    heroDesc: '거동이 불편하시거나 직접 오기 어려우면 신청해 주세요. 담당자가 확인 후 물품을 가져다드려요.',
    langLabel: '언어 선택 / Language',
    name: '이름',
    namePh: '예: 홍길동',
    phone: '연락처',
    dong: '사는 동네 (읍·면·동)',
    dongPh: '선택해 주세요',
    address: '상세 주소',
    addressPh: '예: ○○아파트 101동 202호',
    dropoff: '어디로 가져다드릴까요?',
    dropoffOpts: ['집 앞에 두기', '경비실·택배함', '직접 만나서 받기', '기타 (아래에 적어주세요)'],
    category: '무엇이 필요하세요?',
    categoryOpts: ['먹거리', '생활용품', '위생용품', '영유아용품', '기타'],
    time: '언제가 편하세요?',
    timeOpts: ['오전 (9시~12시)', '오후 (12시~6시)', '아무 때나 괜찮아요'],
    message: '전달할 말',
    messagePh: '거동이 불편해요 / 문 앞에 두고 벨 눌러주세요 등',
    optional: '선택',
    required: '필수',
    submit: '신청하기',
    submitting: '보내는 중…',
    doneTitle: '신청이 접수되었어요',
    doneDesc: '담당자가 확인 후 알려드린 번호로 연락드릴게요.',
    doneBack: '지도로 돌아가기',
    privacy: '입력하신 정보는 물품 전달 목적으로만 사용됩니다.',
  },
  en: {
    back: 'Back to map',
    title: 'Home Delivery',
    heroTitle: "Can't come? We'll come to you",
    heroDesc: 'If it is hard for you to visit in person, please apply here. Our staff will check and deliver the goods to you.',
    langLabel: '언어 선택 / Language',
    name: 'Name',
    namePh: 'e.g. John Smith',
    phone: 'Phone number',
    dong: 'Your neighborhood (eup/myeon/dong)',
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
    messagePh: 'e.g. I have difficulty moving / please ring the bell',
    optional: 'optional',
    required: 'required',
    submit: 'Submit request',
    submitting: 'Sending…',
    doneTitle: 'Your request was received',
    doneDesc: 'Our staff will review it and contact you at the number you provided.',
    doneBack: 'Back to map',
    privacy: 'Your information is used only for delivering the goods.',
  },
  zh: {
    back: '返回地图',
    title: '上门配送',
    heroTitle: '您来不了，我们送上门',
    heroDesc: '如果行动不便或难以亲自前来，请在此申请。工作人员确认后会为您送货上门。',
    langLabel: '언어 선택 / Language',
    name: '姓名',
    namePh: '例：张三',
    phone: '联系电话',
    dong: '居住地区（邑·面·洞）',
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
    messagePh: '例：行动不便 / 请放门口后按门铃',
    optional: '选填',
    required: '必填',
    submit: '提交申请',
    submitting: '发送中…',
    doneTitle: '申请已受理',
    doneDesc: '工作人员确认后会拨打您留下的电话联系您。',
    doneBack: '返回地图',
    privacy: '您填写的信息仅用于物品配送。',
  },
  vi: {
    back: 'Quay lại bản đồ',
    title: 'Giao hàng tận nhà',
    heroTitle: 'Bạn không đến được? Chúng tôi sẽ đến',
    heroDesc: 'Nếu bạn đi lại khó khăn hoặc không thể đến trực tiếp, hãy đăng ký tại đây. Nhân viên sẽ xác nhận và mang hàng đến cho bạn.',
    langLabel: '언어 선택 / Language',
    name: 'Họ và tên',
    namePh: 'VD: Nguyễn Văn A',
    phone: 'Số điện thoại',
    dong: 'Khu vực bạn sống (eup/myeon/dong)',
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
    messagePh: 'VD: Tôi đi lại khó khăn / xin bấm chuông sau khi để hàng',
    optional: 'tùy chọn',
    required: 'bắt buộc',
    submit: 'Gửi đăng ký',
    submitting: 'Đang gửi…',
    doneTitle: 'Đã tiếp nhận đăng ký',
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

export default function DeliveryRequestPage() {
  const [lang, setLang] = useState<Lang>('ko');
  const t = COPY[lang];

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dong, setDong] = useState('');
  const [address, setAddress] = useState('');
  const [dropoffIdx, setDropoffIdx] = useState<number | null>(null);
  const [categoryIdx, setCategoryIdx] = useState<number | null>(null);
  const [timeIdx, setTimeIdx] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit =
    name.trim().length > 0 &&
    phone.trim().length > 0 &&
    dong.length > 0 &&
    address.trim().length > 0 &&
    dropoffIdx !== null &&
    categoryIdx !== null &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || categoryIdx === null || dropoffIdx === null) return;

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
        `전달 위치: ${DROPOFF_KO[dropoffIdx]}`,
        timeIdx !== null ? `희망 시간: ${TIME_KO[timeIdx]}` : null,
        lang !== 'ko' ? `신청 언어: ${LANGS.find((l) => l.value === lang)?.label}` : null,
        message.trim() ? `남긴 말: ${message.trim()}` : null,
      ].filter(Boolean);

      await createHelpRequest({
        phone: phone.trim(),
        dong,
        itemCategory: CATEGORY_VALUES[categoryIdx],
        message: lines.join('\n'),
        channel: 'CITIZEN',
        requestType: 'DELIVERY',
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '신청에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── 완료 ────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-slate-50 px-6 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <CheckCircle2 size={36} aria-hidden />
        </span>
        <h1 className="text-[24px] font-bold text-gray-900">{t.doneTitle}</h1>
        <p className="text-[16px] leading-relaxed text-gray-500">{t.doneDesc}</p>
        <Link
          to="/"
          className="mt-5 flex min-h-[56px] w-full max-w-xs items-center justify-center rounded-2xl bg-blue-600 px-6 text-[17px] font-bold text-white shadow-md transition-colors hover:bg-blue-700"
        >
          {t.doneBack}
        </Link>
      </div>
    );
  }

  // ── 신청 ────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-slate-50 pb-[max(40px,env(safe-area-inset-bottom))]">

      {/* 상단 */}
      <div className="bg-white px-5 pb-5 pt-[max(20px,env(safe-area-inset-top))]">
        <Link
          to="/"
          className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-[16px] font-semibold text-gray-700 shadow-sm transition-colors hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ArrowLeft size={18} className="text-blue-600" aria-hidden />
          {t.back}
        </Link>

        {/* 안내 카드 — "못 오시면, 저희가 갑니다" */}
        <div className="mt-4 rounded-2xl bg-blue-600 px-5 py-5 shadow-md">
          <HandHeart size={26} className="mb-2.5 text-blue-200" aria-hidden />
          <h1 className="text-[23px] font-black leading-tight text-white">{t.heroTitle}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-blue-100">{t.heroDesc}</p>
        </div>

        {/* 언어 선택 */}
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-gray-400">
            <Globe size={14} aria-hidden />
            {t.langLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            {LANGS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLang(l.value)}
                aria-pressed={lang === l.value}
                className={`min-h-[44px] rounded-full border px-4 text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  lang === l.value
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 신청 폼 */}
      <form onSubmit={handleSubmit} className="space-y-5 px-5 py-6">

        <Field label={t.name} badge={t.required}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.namePh}
            autoComplete="name"
            className={INPUT_CLS}
          />
        </Field>

        <Field label={t.phone} badge={t.required}>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-0000-0000"
            className={INPUT_CLS}
          />
        </Field>

        <Field label={t.dong} badge={t.required}>
          <select
            value={dong}
            onChange={(e) => setDong(e.target.value)}
            className={INPUT_CLS}
          >
            <option value="">{t.dongPh}</option>
            {AREA_LIST.map((a) => (
              <option key={a.area} value={a.area}>{a.area}</option>
            ))}
          </select>
        </Field>

        <Field label={t.address} badge={t.required}>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t.addressPh}
            autoComplete="street-address"
            className={INPUT_CLS}
          />
        </Field>

        <Field label={t.dropoff} badge={t.required}>
          <div className="grid grid-cols-1 gap-2">
            {t.dropoffOpts.map((opt, i) => (
              <ChoiceButton
                key={i}
                selected={dropoffIdx === i}
                onClick={() => setDropoffIdx(i)}
              >
                {opt}
              </ChoiceButton>
            ))}
          </div>
        </Field>

        <Field label={t.category} badge={t.required}>
          <div className="grid grid-cols-2 gap-2">
            {t.categoryOpts.map((opt, i) => (
              <ChoiceButton
                key={i}
                selected={categoryIdx === i}
                onClick={() => setCategoryIdx(i)}
                className={i === t.categoryOpts.length - 1 ? 'col-span-2' : ''}
              >
                {opt}
              </ChoiceButton>
            ))}
          </div>
        </Field>

        <Field label={t.time} badge={t.optional}>
          <div className="grid grid-cols-1 gap-2">
            {t.timeOpts.map((opt, i) => (
              <ChoiceButton
                key={i}
                selected={timeIdx === i}
                onClick={() => setTimeIdx(timeIdx === i ? null : i)}
              >
                {opt}
              </ChoiceButton>
            ))}
          </div>
        </Field>

        <Field label={t.message} badge={t.optional}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder={t.messagePh}
            className={`${INPUT_CLS} resize-none leading-relaxed`}
          />
        </Field>

        {error && (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-[15px] text-rose-700">{error}</p>
        )}

        <p className="text-[13px] leading-relaxed text-gray-400">{t.privacy}</p>

        <button
          type="submit"
          disabled={!canSubmit}
          className="flex min-h-[60px] w-full items-center justify-center rounded-2xl bg-blue-600 px-6 text-[18px] font-black text-white shadow-md transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 disabled:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40"
        >
          {submitting ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  );
}

// ── 공통 조각 ─────────────────────────────────────────────────────

const INPUT_CLS =
  'min-h-[56px] w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-[17px] text-gray-900 placeholder-gray-300 outline-none transition-colors focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15';

function Field({
  label,
  badge,
  children,
}: {
  label: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[17px] font-bold text-gray-900">{label}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[12px] font-semibold text-gray-500">
          {badge}
        </span>
      </div>
      {children}
    </div>
  );
}

function ChoiceButton({
  selected,
  onClick,
  className = '',
  children,
}: {
  selected: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-[56px] rounded-xl border px-4 py-3 text-[16px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40 ${
        selected
          ? 'border-blue-600 bg-blue-50 text-blue-800'
          : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
      } ${className}`}
    >
      {children}
    </button>
  );
}
