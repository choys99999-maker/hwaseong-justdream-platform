import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Search, Users, CalendarDays, UserPlus, RotateCcw,
  MessageSquare, CheckCircle2, Download, Printer, Plus,
  X, Edit2, Trash2, PackageCheck, ShieldCheck,
  ClipboardCheck, AlertTriangle, Check, Minus,
} from 'lucide-react';
import StatCard from '../components/common/StatCard';
import type {
  BasicCounseling, Client, ContinuedSupport, LinkageCompletionType,
  ReferralStatus, SupportDecision, SupportItem, Visit, VisitStage, WelfareReferral,
} from '../types';
import { mockClients, mockVisits, mockWelfareReferrals } from '../data/mockClientRecords';
import { mockSites } from '../data/mockSites';
import { SUPPORT_ITEM_CATALOG, findCatalogEntry } from '../data/supportItemCatalog';
import { createOutboundRecords } from '../store/outboundLedger';
import {
  birthYearOf, downloadCsv, extractDong, makeId, maskKoreanName, monthPrefix,
  resolveNextAction, resolveProgressSteps, todayISO, toVisitStage,
  type NextActionTone, type ProgressStep, type StepState,
} from '../utils/supportRecords';

// ─── 선택지 상수 ──────────────────────────────────────────────────────────────
const DONGS = [
  '남양읍', '향남읍', '우정읍', '팔탄면', '마도면', '송산면',
  '서신면', '비봉면', '매송면', '봉담읍',
  '병점1동', '병점2동', '기배동', '화산동', '진안동', '반정동', '오산동',
  '동탄1동', '동탄2동', '동탄3동', '동탄4동', '동탄5동', '동탄6동', '동탄7동', '동탄8동',
];

const REFERRAL_STATUSES: ReferralStatus[] = ['미연계', '연계요청', '읍면동상담중', '연계완료', '연계불요'];
const LINKAGE_TYPES: LinkageCompletionType[] = ['기초생활', '차상위', '긴급복지', '기타', '해당없음'];
const SUPPORT_DECISIONS: SupportDecision[] = ['지원', '미지원', '보류'];
const CONTINUED_SUPPORTS: ContinuedSupport[] = ['미판정', '가능', '불가'];

/** 기관 목록은 그냥드림 사업장 25개소를 그대로 쓴다. 화면에서 임의로 늘리지 않는다. */
const SITE_OPTIONS = [...mockSites].sort((a, b) => a.name.localeCompare(b.name, 'ko'));

/** 목록·모달에는 축약 기관명을 쓴다. 서식(CSV)에는 정식 기관명을 그대로 내보낸다. */
const SITE_SHORT_NAME = new Map(mockSites.map((site) => [site.id, site.displayName]));

/** 1회 방문에 3~5개 지원이 표준이다. */
const MAX_SUPPORT_ITEMS = 5;

// ─── 배지 ─────────────────────────────────────────────────────────────────────
//
// 색은 "상태"에만 쓴다. 단계(1차/2차/3차+)는 teal → sky → indigo 로 이어지는
// 한 계열 안에서만 옮겨 가고, 주의가 필요한 값에만 amber 를 남겨 둔다.

const BADGE_BASE = 'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset';

const REFERRAL_BADGE: Record<ReferralStatus, string> = {
  '미연계':       'bg-slate-50    text-slate-600   ring-slate-300',
  '연계요청':     'bg-sky-50      text-sky-700     ring-sky-600/20',
  '읍면동상담중': 'bg-amber-50    text-amber-700   ring-amber-600/20',
  '연계완료':     'bg-emerald-50  text-emerald-700 ring-emerald-600/20',
  '연계불요':     'bg-white       text-slate-500   ring-slate-200',
};

function ReferralBadge({ status }: { status: ReferralStatus }) {
  return <span className={`${BADGE_BASE} ${REFERRAL_BADGE[status]}`}>{status}</span>;
}

const STAGE_BADGE: Record<VisitStage, string> = {
  '1차':  'bg-teal-50   text-teal-700   ring-teal-600/20',
  '2차':  'bg-sky-50    text-sky-700    ring-sky-600/20',
  '3차+': 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
};

function StageBadge({ stage }: { stage: VisitStage }) {
  return <span className={`${BADGE_BASE} ${STAGE_BADGE[stage]}`}>{stage} 이용</span>;
}

/** boolean 을 화성시 서식 표기(O/X)로 렌더링만 한다. 저장 타입은 boolean 이다. */
function ConductedBadge({ done }: { done: boolean }) {
  return (
    <span className={`${BADGE_BASE} ${done
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
      : 'bg-slate-50 text-slate-500 ring-slate-300'}`}
    >
      {done ? 'O' : 'X'}
    </span>
  );
}

const NEXT_ACTION_DOT: Record<NextActionTone, string> = {
  todo:    'bg-amber-500',
  waiting: 'bg-sky-500',
  done:    'bg-slate-300',
};

const NEXT_ACTION_TEXT: Record<NextActionTone, string> = {
  todo:    'text-slate-800 font-medium',
  waiting: 'text-slate-600',
  done:    'text-slate-400',
};

/** 목록에서는 배지를 더 늘리지 않고 점 + 텍스트로 둔다. (배지가 많아지면 읽히지 않는다) */
function NextActionCell({ label, tone }: { label: string; tone: NextActionTone }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${NEXT_ACTION_DOT[tone]}`} />
      <span className={NEXT_ACTION_TEXT[tone]}>{label}</span>
    </span>
  );
}

// ─── 진행 단계 스텝퍼 ─────────────────────────────────────────────────────────
const STEP_DOT: Record<StepState, string> = {
  done:    'bg-teal-600 text-white ring-teal-600',
  current: 'bg-white text-teal-700 ring-teal-500',
  todo:    'bg-white text-slate-400 ring-slate-200',
  skipped: 'bg-slate-50 text-slate-300 ring-slate-200',
};

const STEP_LABEL: Record<StepState, string> = {
  done:    'text-slate-700',
  current: 'text-teal-700 font-semibold',
  todo:    'text-slate-400',
  skipped: 'text-slate-300',
};

function ProgressStepper({ steps }: { steps: ProgressStep[] }) {
  return (
    <ol className="flex items-start">
      {steps.map((step, index) => {
        const prev = steps[index - 1];
        const nextStep = steps[index + 1];
        return (
          <li key={step.key} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <span className={`h-px flex-1 ${index === 0 ? 'bg-transparent' : prev?.state === 'done' ? 'bg-teal-300' : 'bg-slate-200'}`} />
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-2 ${STEP_DOT[step.state]}`}>
                {step.state === 'done' ? <Check size={13} strokeWidth={3} />
                  : step.state === 'skipped' ? <Minus size={13} />
                  : index + 1}
              </span>
              <span className={`h-px flex-1 ${index === steps.length - 1 ? 'bg-transparent' : step.state === 'done' && nextStep ? 'bg-teal-300' : 'bg-slate-200'}`} />
            </div>
            <span className={`mt-1.5 text-center text-[11px] leading-tight ${STEP_LABEL[step.state]}`}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ─── 레이아웃 조각 ────────────────────────────────────────────────────────────
/** 모달 폼 한 구획. 단계별로 필요한 구획만 켜서 단일 모달 흐름을 유지한다. */
function FormSection({
  step,
  title,
  hint,
  accent = false,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-xl border p-4 ${accent ? 'border-teal-300 bg-teal-50/40' : 'border-slate-200 bg-white'}`}>
      <div className="mb-3.5 flex items-baseline gap-2">
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
          accent ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'
        }`}>
          {step}
        </span>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      <div className="space-y-3.5">{children}</div>
    </section>
  );
}

/** 상세 화면의 2열 정보 카드 한 칸 */
function InfoCard({ label, children, span = false }: { label: string; children: ReactNode; span?: boolean }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 ${span ? 'col-span-2' : ''}`}>
      <p className="text-[11px] text-slate-400">{label}</p>
      <div className="mt-1 text-sm text-slate-800">{children}</div>
    </div>
  );
}

/** 방문 카드 안의 라벨-값 한 줄 */
function VisitRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-[5.5rem] shrink-0 pt-0.5 text-xs text-slate-400">{label}</span>
      <div className="min-w-0 flex-1 text-xs text-slate-700">{children}</div>
    </div>
  );
}

function SupportItemChips({ items }: { items: SupportItem[] }) {
  if (items.length === 0) return <span className="text-slate-400">-</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item.itemId}
          title={item.outboundRecordId ? `재고 출고 기록 연결됨 (${item.outboundRecordId})` : undefined}
          className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-slate-700 ring-1 ring-inset ring-slate-200"
        >
          {/* 출고 기록과 연결된 물품은 아이콘을 teal 로 표시한다. */}
          <PackageCheck size={11} className={item.outboundRecordId ? 'text-teal-500' : 'text-slate-400'} />
          {/* 품목명에 이미 포장 단위가 들어 있어(담요 1매) 수량만 덧붙인다. */}
          {item.itemName} × {item.quantity}
        </span>
      ))}
    </span>
  );
}

// ─── 폼 타입 ─────────────────────────────────────────────────────────────────
type ModalMode = 'new' | 'visit' | 'edit';

interface SupportItemDraft {
  itemId: string;
  quantity: number;
}

interface ClientForm {
  clientName: string;
  birthDate: string;
  address: string;
}

interface VisitForm {
  siteId: string;
  visitDate: string;
  identityVerified: boolean;
  checklistCompleted: boolean;
  supportDecision: SupportDecision;
  supportItems: SupportItemDraft[];
  counselingConducted: boolean;
  counselingNote: string;
  needsAdditionalSupport: boolean;
  referralStatus: ReferralStatus;
  linkedDong: string;
  linkedTeam: string;
  linkageType: '' | LinkageCompletionType;
  linkageService: string;
  dongCounselingDoneAt: string;
  continuedSupport: ContinuedSupport;
  resultNote: string;
}

function emptyClientForm(): ClientForm {
  return { clientName: '', birthDate: '', address: '' };
}

function emptyVisitForm(): VisitForm {
  return {
    siteId: '', visitDate: todayISO(),
    identityVerified: true, checklistCompleted: false, supportDecision: '지원',
    supportItems: [],
    counselingConducted: false, counselingNote: '', needsAdditionalSupport: false,
    referralStatus: '미연계', linkedDong: '', linkedTeam: '',
    linkageType: '', linkageService: '',
    dongCounselingDoneAt: '', continuedSupport: '미판정', resultNote: '',
  };
}

function toSupportItems(drafts: SupportItemDraft[]): SupportItem[] {
  return drafts.flatMap((draft) => {
    const entry = findCatalogEntry(draft.itemId);
    if (!entry) return [];
    return [{
      itemId: entry.itemId,
      itemName: entry.itemName,
      quantity: draft.quantity,
      unit: entry.unit,
      // outboundRecordId 는 재고 브랜치와 붙는 integration 단계에서 채운다.
    }];
  });
}

// 폼 요소 공통 클래스 — 화면 전체에서 테두리·포커스 링을 하나로 맞춘다.
// 폭은 FIELD_BASE 에 넣지 않는다. 넣으면 물품 행처럼 폭을 직접 주는 자리에서
// w-full 과 flex-1 / w-20 이 부딪혀 컨트롤이 찌그러진다.
const FIELD_BASE = 'rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500';
const FIELD = `${FIELD_BASE} w-full`;
const FIELD_LABEL = 'mb-1.5 block text-xs font-medium text-slate-600';

// ─── 지원 물품 편집기 ─────────────────────────────────────────────────────────
function SupportItemsEditor({
  items,
  onChange,
}: {
  items: SupportItemDraft[];
  onChange: (next: SupportItemDraft[]) => void;
}) {
  const usedIds = new Set(items.map((item) => item.itemId));

  const addRow = () => {
    const next = SUPPORT_ITEM_CATALOG.find((entry) => !usedIds.has(entry.itemId));
    if (!next) return;
    onChange([...items, { itemId: next.itemId, quantity: 1 }]);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className={FIELD_LABEL + ' mb-0'}>
          지원 물품 <span className="font-normal text-slate-400">(1회 3~5개)</span>
        </span>
        <button
          type="button"
          onClick={addRow}
          disabled={items.length >= MAX_SUPPORT_ITEMS}
          className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          <Plus size={12} />
          품목 추가
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-400">
          지원한 물품을 추가하세요.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => {
            const entry = findCatalogEntry(item.itemId);
            return (
              <div key={index} className="flex items-center gap-2">
                <select
                  value={item.itemId}
                  onChange={(e) => {
                    const next = [...items];
                    next[index] = { ...next[index], itemId: e.target.value };
                    onChange(next);
                  }}
                  className={`${FIELD_BASE} min-w-0 flex-1`}
                >
                  {SUPPORT_ITEM_CATALOG.map((option) => (
                    <option
                      key={option.itemId}
                      value={option.itemId}
                      disabled={option.itemId !== item.itemId && usedIds.has(option.itemId)}
                    >
                      {option.itemName}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => {
                    const next = [...items];
                    next[index] = { ...next[index], quantity: Math.max(1, Number(e.target.value) || 1) };
                    onChange(next);
                  }}
                  className={`${FIELD_BASE} w-20 text-right`}
                />
                <span className="w-8 shrink-0 text-xs text-slate-400">{entry?.unit ?? ''}</span>
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, i) => i !== index))}
                  aria-label="품목 삭제"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 방문 카드 ────────────────────────────────────────────────────────────────
/**
 * 타임라인의 방문 1건. 차수별로 실제 업무가 다르므로 보여 주는 항목도 다르다.
 *   1차  : 본인확인 / 자가 체크리스트 / 지원 판단 / 지원 물품
 *   2차  : 지원 물품 / 기본상담 / 추가지원 필요 / 복지연계
 *   3차+ : 지원 물품 / 읍면동 추가상담 / 지속지원 판정
 */
function VisitCard({ visit, referral }: { visit: Visit; referral: WelfareReferral | undefined }) {
  const stage = visit.visitStage;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2">
      {stage === '1차' && (
        <>
          <VisitRow label="본인확인"><ConductedBadge done={visit.identityVerified} /></VisitRow>
          <VisitRow label="자가 체크리스트"><ConductedBadge done={visit.checklistCompleted} /></VisitRow>
          <VisitRow label="지원 판단"><span className="font-medium text-slate-800">{visit.supportDecision}</span></VisitRow>
          <VisitRow label="지원 물품"><SupportItemChips items={visit.supportItems} /></VisitRow>
        </>
      )}

      {stage === '2차' && (
        <>
          <VisitRow label="지원 물품"><SupportItemChips items={visit.supportItems} /></VisitRow>
          <VisitRow label="기본상담"><ConductedBadge done={visit.basicCounseling?.conducted ?? false} /></VisitRow>
          <VisitRow label="추가지원 필요">
            {visit.basicCounseling?.needsAdditionalSupport
              ? <span className="font-medium text-amber-700">필요 — 읍면동 연계 대상</span>
              : <span className="text-slate-400">해당 없음</span>}
          </VisitRow>
          <VisitRow label="복지연계">
            {referral ? <ReferralBadge status={referral.status} /> : <span className="text-slate-400">미연계</span>}
          </VisitRow>
        </>
      )}

      {stage === '3차+' && (
        <>
          <VisitRow label="지원 물품"><SupportItemChips items={visit.supportItems} /></VisitRow>
          <VisitRow label="읍면동 추가상담">
            {referral?.dongCounselingDoneAt
              ? <span className="text-slate-800">{referral.dongCounselingDoneAt} 완료</span>
              : <span className="text-amber-700">미완료 — 결과 확인 필요</span>}
          </VisitRow>
          <VisitRow label="지속지원 판정">
            <span className={referral && referral.continuedSupport !== '미판정'
              ? 'font-medium text-slate-800'
              : 'text-amber-700'}
            >
              {referral?.continuedSupport ?? '미판정'}
            </span>
          </VisitRow>
        </>
      )}

      {visit.basicCounseling?.note && (
        <p className="mt-1 border-t border-slate-100 pt-2 text-xs italic leading-relaxed text-slate-500">
          "{visit.basicCounseling.note}"
        </p>
      )}
    </div>
  );
}

// ─── 대상자 상세 모달 ──────────────────────────────────────────────────────────
function DetailModal({
  client,
  visits,
  referral,
  onClose,
  onEdit,
  onAddVisit,
}: {
  client: Client;
  visits: Visit[];
  referral: WelfareReferral | undefined;
  onClose: () => void;
  onEdit: () => void;
  onAddVisit: () => void;
}) {
  const steps = resolveProgressSteps(visits, referral);
  const nextAction = resolveNextAction(visits, referral);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl bg-white shadow-lg ring-1 ring-slate-900/5"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{client.nameMasked}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {client.birthYear}년생 · {client.residenceDong} · {client.visitCount}회 이용
              {client.visitCount >= 2 && (
                <span className="ml-1.5 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">반복방문</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onAddVisit}
              className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1"
            >
              <Plus size={13} />
              방문 추가
            </button>
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <Edit2 size={13} />
              수정
            </button>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 진행 단계 스텝퍼 + 다음 조치 */}
        <div className="border-b border-slate-200 bg-slate-50/60 px-6 py-5">
          <ProgressStepper steps={steps} />
          <div className="mt-4 flex items-center justify-center gap-2 text-xs">
            <span className="text-slate-400">다음 조치</span>
            <NextActionCell label={nextAction.label} tone={nextAction.tone} />
          </div>
        </div>

        <div className="space-y-6 p-6">
          {/* 기본 정보 — 전체 생년월일·상세주소는 이 화면에서만 보여준다. */}
          <section>
            <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">기본 정보</h3>
            <div className="grid grid-cols-2 gap-3">
              <InfoCard label="생년월일">{client.birthDate ?? `${client.birthYear}년생`}</InfoCard>
              <InfoCard label="최초 이용일">{client.firstVisitDate}</InfoCard>
              <InfoCard label="주소" span>{client.addressDetail ?? client.residenceDong}</InfoCard>
            </div>
          </section>

          {/* 회차별 이력 타임라인 — 1차 → 2차 → 3차+ */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              이용 · 상담 · 복지연계 이력
            </h3>
            <div>
              {visits.map((visit, idx) => {
                const isLast = idx === visits.length - 1;
                return (
                  <div key={visit.id} className="relative flex gap-3.5">
                    {/* 타임라인 축 */}
                    <div className="flex flex-col items-center">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2 ${
                        isLast
                          ? 'bg-teal-600 text-white ring-teal-200'
                          : 'bg-white text-slate-500 ring-slate-200'
                      }`}>
                        {visit.visitNo}
                      </div>
                      {!isLast && <div className="mt-1 w-px grow bg-slate-200" />}
                    </div>

                    {/* 내용 */}
                    <div className={`min-w-0 flex-1 ${!isLast ? 'pb-5' : ''}`}>
                      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <StageBadge stage={visit.visitStage} />
                        <span className="text-xs text-slate-500">{visit.visitDate}</span>
                        <span className="text-xs text-slate-400">· {SITE_SHORT_NAME.get(visit.siteId) ?? visit.orgName}</span>
                      </div>
                      <VisitCard visit={visit} referral={referral} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 복지연계 상세 — 2열 정보 카드 */}
          <section>
            <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">복지연계 상세</h3>
            {!referral ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
                아직 읍면동 복지연계가 시작되지 않았습니다.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="연계 상태"><ReferralBadge status={referral.status} /></InfoCard>
                <InfoCard label="2차 연계처(읍면동)">
                  <span className="font-medium">{referral.linkedDong || '-'}</span>
                </InfoCard>
                <InfoCard label="맞춤형복지팀">{referral.linkedTeam ?? '-'}</InfoCard>
                <InfoCard label="연계 요청일">{referral.requestedAt ?? '-'}</InfoCard>
                <InfoCard label="읍면동 추가상담 완료">
                  {referral.dongCounselingDoneAt ?? <span className="text-slate-400">미완료</span>}
                </InfoCard>
                <InfoCard label="지속지원 판정">
                  <span className="font-medium">{referral.continuedSupport}</span>
                </InfoCard>
                <InfoCard label="연계 유형">{referral.linkageType ?? '-'}</InfoCard>
                <InfoCard label="연계 서비스">
                  <span className="font-medium text-teal-700">{referral.linkageService ?? '-'}</span>
                </InfoCard>
                {referral.resultNote && (
                  <InfoCard label="연계 결과 / 기타 내역" span>{referral.resultNote}</InfoCard>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── 등록/방문추가/수정 모달 ──────────────────────────────────────────────────
function RecordModal({
  mode,
  client,
  nextVisitNo,
  clientForm,
  visitForm,
  duplicates,
  onClientChange,
  onVisitChange,
  onPickDuplicate,
  onSave,
  onClose,
}: {
  mode: ModalMode;
  client: Client | null;
  nextVisitNo: number;
  clientForm: ClientForm;
  visitForm: VisitForm;
  duplicates: Client[];
  onClientChange: (patch: Partial<ClientForm>) => void;
  onVisitChange: (patch: Partial<VisitForm>) => void;
  onPickDuplicate: (client: Client) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const stage = toVisitStage(nextVisitNo);
  const isVisitInput = mode === 'new' || mode === 'visit';
  const needsItems = visitForm.supportDecision === '지원';

  const title = mode === 'new'
    ? '신규 이용자 등록 (1차 이용)'
    : mode === 'visit'
      ? `방문 추가 — ${stage} 이용`
      : '이용자 정보 수정';

  const canSave = mode === 'edit'
    ? Boolean(clientForm.clientName && clientForm.birthDate && clientForm.address)
    : mode === 'new'
      ? Boolean(
          clientForm.clientName && clientForm.birthDate && clientForm.address &&
          visitForm.siteId && visitForm.visitDate &&
          (!needsItems || visitForm.supportItems.length > 0),
        )
      : Boolean(
          visitForm.siteId && visitForm.visitDate &&
          (!needsItems || visitForm.supportItems.length > 0),
        );

  // 구획 번호는 실제로 보이는 것만 1부터 매긴다.
  let sectionNo = 0;
  const step = () => (sectionNo += 1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-lg ring-1 ring-slate-900/5"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} aria-label="닫기" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3.5 bg-slate-50/60 p-6">
          {/* 방문 추가 시 대상 이용자 요약 (읽기 전용) */}
          {mode === 'visit' && client && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{client.nameMasked}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {client.birthYear}년생 · {client.residenceDong} · 기존 {client.visitCount}회 방문
                </p>
              </div>
              <StageBadge stage={stage} />
            </div>
          )}

          {/* 이용자 동일성 안내 — 자동 병합하지 않고 담당자가 직접 고르게 한다. */}
          {mode === 'new' && duplicates.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
                <AlertTriangle size={13} />
                같은 이름·생년월일의 이용자가 이미 있습니다. 동일인이면 방문을 추가하세요.
              </p>
              <div className="mt-2.5 space-y-1.5">
                {duplicates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => onPickDuplicate(candidate)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-700 ring-1 ring-amber-200 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <span className="truncate">
                      {candidate.nameMasked} · {candidate.birthYear}년생 · {candidate.residenceDong}
                      <span className="ml-1.5 text-slate-400">({candidate.visitCount}회 방문)</span>
                    </span>
                    <span className="shrink-0 font-medium text-amber-800">이 이용자에게 방문 추가</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-amber-800">
                동명이인일 수 있으니 자동으로 합치지 않습니다. 확인 후 선택하세요.
              </p>
            </div>
          )}

          {/* ── 기본 정보 ── */}
          {(mode === 'new' || mode === 'edit') && (
            <FormSection step={step()} title="기본 정보">
              <div>
                <label className={FIELD_LABEL}>
                  대상자명 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={clientForm.clientName}
                  onChange={e => onClientChange({ clientName: e.target.value })}
                  placeholder="예: 홍길동 (저장 시 홍○동으로 마스킹됩니다)"
                  className={FIELD}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={FIELD_LABEL}>
                    생년월일 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={clientForm.birthDate}
                    onChange={e => onClientChange({ birthDate: e.target.value })}
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>거주 읍면동</label>
                  <input
                    type="text"
                    readOnly
                    value={extractDong(clientForm.address) || '주소 입력 시 자동'}
                    className={FIELD + ' bg-slate-50 text-slate-500'}
                  />
                </div>
              </div>

              <div>
                <label className={FIELD_LABEL}>
                  주소 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={clientForm.address}
                  onChange={e => onClientChange({ address: e.target.value })}
                  placeholder="화성시 ○○읍 ○○로 00"
                  className={FIELD}
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  목록에는 거주 읍면동까지만 표시됩니다. 상세주소는 상세 화면에서만 보입니다.
                </p>
              </div>
            </FormSection>
          )}

          {isVisitInput && (
            <>
              {/* ── 방문 정보 ── */}
              <FormSection step={step()} title="방문 정보" hint={`${stage} 이용`}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={FIELD_LABEL}>
                      기관 <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={visitForm.siteId}
                      onChange={e => onVisitChange({ siteId: e.target.value })}
                      className={FIELD}
                    >
                      <option value="">기관을 선택하세요</option>
                      {SITE_OPTIONS.map(site => (
                        <option key={site.id} value={site.id}>{site.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={FIELD_LABEL}>
                      방문일자 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={visitForm.visitDate}
                      onChange={e => onVisitChange({ visitDate: e.target.value })}
                      className={FIELD}
                    />
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={visitForm.identityVerified}
                    onChange={e => onVisitChange({ identityVerified: e.target.checked })}
                    className="accent-teal-600"
                  />
                  본인확인 완료
                </label>
              </FormSection>

              {/* ── 1차 지원 / 물품 지원 ── */}
              <FormSection
                step={step()}
                title={stage === '1차' ? '1차 지원' : '물품 지원'}
                accent={stage === '1차'}
              >
                {stage === '1차' && (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={visitForm.checklistCompleted}
                      onChange={e => onVisitChange({ checklistCompleted: e.target.checked })}
                      className="accent-teal-600"
                    />
                    <ClipboardCheck size={14} className="text-slate-400" />
                    자가 체크리스트 작성 완료
                  </label>
                )}

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span className="flex items-center gap-1.5 text-sm text-slate-700">
                    <ShieldCheck size={14} className="text-slate-400" />
                    담당자 지원 판단
                  </span>
                  {SUPPORT_DECISIONS.map(decision => (
                    <label key={decision} className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700">
                      <input
                        type="radio" name="supportDecision" value={decision}
                        checked={visitForm.supportDecision === decision}
                        onChange={() => onVisitChange({ supportDecision: decision })}
                        className="accent-teal-600"
                      />
                      {decision}
                    </label>
                  ))}
                </div>

                <SupportItemsEditor
                  items={visitForm.supportItems}
                  onChange={next => onVisitChange({ supportItems: next })}
                />
              </FormSection>

              {/* ── 2차 상담 ── */}
              {stage !== '1차' && (
                <FormSection step={step()} title="2차 상담" accent={stage === '2차'}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={visitForm.counselingConducted}
                      onChange={e => onVisitChange({ counselingConducted: e.target.checked })}
                      className="accent-teal-600"
                    />
                    <MessageSquare size={14} className="text-slate-400" />
                    기본상담 실시
                  </label>
                  <textarea
                    value={visitForm.counselingNote}
                    onChange={e => onVisitChange({ counselingNote: e.target.value })}
                    rows={2}
                    placeholder="상담 내용"
                    className={FIELD + ' resize-none'}
                  />
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={visitForm.needsAdditionalSupport}
                      onChange={e => onVisitChange({ needsAdditionalSupport: e.target.checked })}
                      className="mt-0.5 accent-teal-600"
                    />
                    추가지원 필요 — 읍면동 맞춤형복지팀 연계 대상
                  </label>
                </FormSection>
              )}

              {/* ── 복지연계 ── */}
              {stage !== '1차' && (
                <FormSection step={step()} title="복지연계" accent={stage === '2차'}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={FIELD_LABEL}>연계 상태</label>
                      <select
                        value={visitForm.referralStatus}
                        onChange={e => onVisitChange({ referralStatus: e.target.value as ReferralStatus })}
                        className={FIELD}
                      >
                        {REFERRAL_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={FIELD_LABEL}>2차 연계처 (읍면동)</label>
                      <select
                        value={visitForm.linkedDong}
                        onChange={e => onVisitChange({ linkedDong: e.target.value })}
                        className={FIELD}
                      >
                        <option value="">읍면동 선택</option>
                        {DONGS.map(dong => <option key={dong} value={dong}>{dong}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={FIELD_LABEL}>맞춤형복지팀</label>
                      <input
                        type="text"
                        value={visitForm.linkedTeam}
                        onChange={e => onVisitChange({ linkedTeam: e.target.value })}
                        placeholder="예: 맞춤형복지1팀"
                        className={FIELD}
                      />
                    </div>
                    <div>
                      <label className={FIELD_LABEL}>연계 유형</label>
                      <select
                        value={visitForm.linkageType}
                        onChange={e => onVisitChange({ linkageType: e.target.value as '' | LinkageCompletionType })}
                        className={FIELD}
                      >
                        <option value="">선택 안 함</option>
                        {LINKAGE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={FIELD_LABEL}>복지연계 서비스</label>
                      <input
                        type="text"
                        value={visitForm.linkageService}
                        onChange={e => onVisitChange({ linkageService: e.target.value })}
                        placeholder="예: 통합돌봄, 반찬지원"
                        className={FIELD}
                      />
                    </div>
                  </div>
                </FormSection>
              )}

              {/* ── 3차 · 지속지원 ── */}
              {stage === '3차+' && (
                <FormSection step={step()} title="3차 · 지속지원" hint="읍면동 추가상담 확인" accent>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={FIELD_LABEL}>읍면동 추가상담 완료일</label>
                      <input
                        type="date"
                        value={visitForm.dongCounselingDoneAt}
                        onChange={e => onVisitChange({ dongCounselingDoneAt: e.target.value })}
                        className={FIELD + ' bg-white'}
                      />
                    </div>
                    <div>
                      <label className={FIELD_LABEL}>지속지원 판정</label>
                      <select
                        value={visitForm.continuedSupport}
                        onChange={e => onVisitChange({ continuedSupport: e.target.value as ContinuedSupport })}
                        className={FIELD + ' bg-white'}
                      >
                        {CONTINUED_SUPPORTS.map(value => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className={FIELD_LABEL}>연계 결과 / 기타 내역</label>
                      <textarea
                        value={visitForm.resultNote}
                        onChange={e => onVisitChange({ resultNote: e.target.value })}
                        rows={2}
                        placeholder="읍면동 상담 결과, 지속지원 사유 등"
                        className={FIELD + ' resize-none bg-white'}
                      />
                    </div>
                  </div>
                </FormSection>
              )}
            </>
          )}
        </div>

        {/* 버튼 */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
          {isVisitInput && needsItems && visitForm.supportItems.length === 0 && (
            <p className="mr-auto text-xs text-slate-400">지원 판단이 '지원'이면 물품을 1개 이상 추가하세요.</p>
          )}
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            취소
          </button>
          <button
            onClick={onSave}
            disabled={!canSave}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          >
            {mode === 'edit' ? '수정 완료' : mode === 'visit' ? '방문 등록' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function SupportRecordsPage() {
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [visits, setVisits] = useState<Visit[]>(mockVisits);
  const [referrals, setReferrals] = useState<WelfareReferral[]>(mockWelfareReferrals);

  const [keyword, setKeyword] = useState('');
  const [dongFilter, setDongFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [detailClientId, setDetailClientId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [targetClientId, setTargetClientId] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState<ClientForm>(emptyClientForm);
  const [visitForm, setVisitForm] = useState<VisitForm>(emptyVisitForm);

  // ── 파생 인덱스 ────────────────────────────────────────────────────────────
  const visitsByClient = useMemo(() => {
    const map = new Map<string, Visit[]>();
    for (const visit of visits) {
      const list = map.get(visit.clientId);
      if (list) list.push(visit);
      else map.set(visit.clientId, [visit]);
    }
    for (const list of map.values()) list.sort((a, b) => a.visitNo - b.visitNo);
    return map;
  }, [visits]);

  const referralByClient = useMemo(() => {
    const map = new Map<string, WelfareReferral>();
    for (const referral of referrals) map.set(referral.clientId, referral);
    return map;
  }, [referrals]);

  const rows = useMemo(() => clients.map((client) => {
    const clientVisits = visitsByClient.get(client.id) ?? [];
    const referral = referralByClient.get(client.id);
    return {
      client,
      visits: clientVisits,
      latestVisit: clientVisits[clientVisits.length - 1],
      referral,
      nextAction: resolveNextAction(clientVisits, referral),
    };
  }), [clients, visitsByClient, referralByClient]);

  // ── 통계 ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = todayISO();
    const thisMonth = monthPrefix(today);
    return {
      monthLabel:      `${Number(thisMonth.slice(5))}월 누적 방문`,
      todayCount:      visits.filter(v => v.visitDate === today).length,
      monthCount:      visits.filter(v => monthPrefix(v.visitDate) === thisMonth).length,
      firstVisitCount: visits.filter(v => v.visitStage === '1차').length,
      repeatVisitCount: visits.filter(v => v.visitStage !== '1차').length,
      referralOngoing: referrals.filter(r => r.status === '연계요청' || r.status === '읍면동상담중').length,
      referralDone:    referrals.filter(r => r.status === '연계완료').length,
    };
  }, [visits, referrals]);

  // ── 필터 ───────────────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    const kw = keyword.trim();
    return rows.filter(({ client, latestVisit, referral }) => {
      const matchesKw = kw === ''
        || client.nameMasked.includes(kw)
        || (latestVisit?.orgName.includes(kw) ?? false);
      const matchesDong = dongFilter === 'all' || referral?.linkedDong === dongFilter;
      const status = referral?.status ?? '미연계';
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      return matchesKw && matchesDong && matchesStatus;
    });
  }, [rows, keyword, dongFilter, statusFilter]);

  const detailRow = rows.find(row => row.client.id === detailClientId);
  const targetClient = clients.find(client => client.id === targetClientId) ?? null;
  const nextVisitNo = modalMode === 'visit' && targetClient ? targetClient.visitCount + 1 : 1;

  // ── 이용자 동일성 후보 (자동 병합하지 않는다) ───────────────────────────────
  const duplicates = useMemo(() => {
    if (modalMode !== 'new') return [];
    const name = clientForm.clientName.trim();
    if (!name) return [];
    const masked = maskKoreanName(name);
    return clients.filter(client =>
      client.nameMasked === masked &&
      (clientForm.birthDate === '' || client.birthDate === clientForm.birthDate),
    );
  }, [modalMode, clientForm.clientName, clientForm.birthDate, clients]);

  // ── 모달 열기 ──────────────────────────────────────────────────────────────
  const openNewClient = () => {
    setTargetClientId(null);
    setClientForm(emptyClientForm());
    setVisitForm(emptyVisitForm());
    setModalMode('new');
  };

  const openAddVisit = (client: Client) => {
    const existing = referralByClient.get(client.id);
    setTargetClientId(client.id);
    setClientForm(emptyClientForm());
    setVisitForm({
      ...emptyVisitForm(),
      siteId: visitsByClient.get(client.id)?.slice(-1)[0]?.siteId ?? '',
      referralStatus: existing?.status ?? '미연계',
      linkedDong: existing?.linkedDong ?? '',
      linkedTeam: existing?.linkedTeam ?? '',
      linkageType: existing?.linkageType ?? '',
      linkageService: existing?.linkageService ?? '',
      dongCounselingDoneAt: existing?.dongCounselingDoneAt ?? '',
      continuedSupport: existing?.continuedSupport ?? '미판정',
      resultNote: existing?.resultNote ?? '',
    });
    setDetailClientId(null);
    setModalMode('visit');
  };

  const openEditClient = (client: Client) => {
    setTargetClientId(client.id);
    setClientForm({
      clientName: client.nameMasked,
      birthDate: client.birthDate ?? '',
      address: client.addressDetail ?? '',
    });
    setDetailClientId(null);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setTargetClientId(null);
  };

  // ── 저장 ───────────────────────────────────────────────────────────────────
  /** 방문 + (2차 이상이면) 복지연계를 함께 반영한다. */
  const commitVisit = (client: Client, visitNo: number) => {
    const site = mockSites.find(candidate => candidate.id === visitForm.siteId);
    if (!site) return;

    const stage = toVisitStage(visitNo);
    const visitId = makeId('vs');
    const existingReferral = referralByClient.get(client.id);

    const basicCounseling: BasicCounseling | undefined = stage === '1차'
      ? undefined
      : {
          conducted: visitForm.counselingConducted,
          note: visitForm.counselingNote.trim() || undefined,
          needsAdditionalSupport: visitForm.needsAdditionalSupport,
        };

    // 연계는 2차부터. '미연계'이고 기존 연계도 없으면 레코드를 만들지 않는다.
    const shouldTrackReferral = stage !== '1차'
      && (visitForm.referralStatus !== '미연계' || Boolean(existingReferral));

    let referralId: string | undefined;
    if (shouldTrackReferral) {
      referralId = existingReferral?.id ?? makeId('rf');
      const next: WelfareReferral = {
        id: referralId,
        clientId: client.id,
        originVisitId: existingReferral?.originVisitId ?? visitId,
        status: visitForm.referralStatus,
        linkedDong: visitForm.linkedDong,
        linkedTeam: visitForm.linkedTeam.trim() || undefined,
        requestedAt: existingReferral?.requestedAt
          ?? (visitForm.referralStatus === '미연계' ? undefined : visitForm.visitDate),
        dongCounselingDoneAt: visitForm.dongCounselingDoneAt || undefined,
        linkageType: visitForm.linkageType || undefined,
        linkageService: visitForm.linkageService.trim() || undefined,
        continuedSupport: visitForm.continuedSupport,
        resultNote: visitForm.resultNote.trim() || undefined,
        updatedAt: visitForm.visitDate,
      };
      setReferrals(prev => existingReferral
        ? prev.map(item => (item.id === existingReferral.id ? next : item))
        : [...prev, next]);
    }

    // 지원이 확정된 물품은 사업장 출고로 기록하고, 만들어진 출고 레코드 id 를
    // 각 지원 물품에 되돌려 단다. 재고 화면은 이 원장을 구독해 표시 재고를 줄인다.
    let supportItems = toSupportItems(visitForm.supportItems);
    if (visitForm.supportDecision === '지원' && supportItems.length > 0) {
      const outbound = createOutboundRecords({
        visitId,
        clientId: client.id,
        siteId: site.id,
        siteName: site.name,
        outboundDate: visitForm.visitDate,
        items: supportItems,
      });
      const outboundIdByItem = new Map(outbound.map((record) => [record.itemId, record.id]));
      supportItems = supportItems.map((item) => ({
        ...item,
        outboundRecordId: outboundIdByItem.get(item.itemId),
      }));
    }

    const newVisit: Visit = {
      id: visitId,
      clientId: client.id,
      visitNo,
      visitStage: stage,
      visitDate: visitForm.visitDate,
      siteId: site.id,
      orgName: site.name,
      identityVerified: visitForm.identityVerified,
      checklistCompleted: stage === '1차' ? visitForm.checklistCompleted : false,
      supportDecision: visitForm.supportDecision,
      supportItems,
      basicCounseling,
      // 이 방문에서 연계가 새로 시작된 경우에만 연결한다.
      referralId: referralId && !existingReferral ? referralId : undefined,
    };
    setVisits(prev => [...prev, newVisit]);

    return { site, visit: newVisit };
  };

  const handleSave = () => {
    if (modalMode === 'edit' && targetClient) {
      const masked = maskKoreanName(clientForm.clientName);
      setClients(prev => prev.map(client => client.id !== targetClient.id ? client : {
        ...client,
        nameMasked: masked,
        birthYear: birthYearOf(clientForm.birthDate),
        birthDate: clientForm.birthDate,
        residenceDong: extractDong(clientForm.address) || client.residenceDong,
        addressDetail: clientForm.address,
      }));
      closeModal();
      return;
    }

    if (modalMode === 'visit' && targetClient) {
      const result = commitVisit(targetClient, targetClient.visitCount + 1);
      if (!result) return;
      setClients(prev => prev.map(client => client.id !== targetClient.id ? client : {
        ...client,
        regionId: result.site.district,
        visitCount: client.visitCount + 1,
        lastVisitDate: visitForm.visitDate > client.lastVisitDate ? visitForm.visitDate : client.lastVisitDate,
      }));
      closeModal();
      setDetailClientId(targetClient.id);
      return;
    }

    if (modalMode === 'new') {
      const site = mockSites.find(candidate => candidate.id === visitForm.siteId);
      if (!site) return;

      const newClient: Client = {
        id: makeId('cl'),
        nameMasked: maskKoreanName(clientForm.clientName),
        birthYear: birthYearOf(clientForm.birthDate),
        birthDate: clientForm.birthDate,
        residenceDong: extractDong(clientForm.address),
        addressDetail: clientForm.address,
        regionId: site.district,
        firstVisitDate: visitForm.visitDate,
        lastVisitDate: visitForm.visitDate,
        visitCount: 1,
      };
      setClients(prev => [newClient, ...prev]);
      commitVisit(newClient, 1);
      closeModal();
      setDetailClientId(newClient.id);
    }
  };

  // ── CSV — 목록과 같은 수준의 개인정보만 내보낸다. ──────────────────────────
  const handleCsv = () => {
    downloadCsv(
      '이용자상담복지연계관리.csv',
      ['연번', '기관명', '방문차수', '방문횟수', '대상자', '출생연도', '거주 읍면동', '최근 방문일', '2차 연계처', '기본상담', '연계상태', '다음 조치'],
      filteredRows.map(({ client, latestVisit, referral, nextAction }, index) => [
        index + 1,
        latestVisit?.orgName ?? '',   // CSV 는 서식 호환을 위해 정식 기관명
        latestVisit?.visitStage ?? '',
        client.visitCount,
        client.nameMasked,
        `${client.birthYear}년생`,
        client.residenceDong,
        client.lastVisitDate,
        referral?.linkedDong ?? '',
        latestVisit?.basicCounseling?.conducted ? 'O' : 'X',
        referral?.status ?? '미연계',
        nextAction.label,
      ]),
    );
  };

  return (
    <div className="space-y-5">
      {/* 탭 안에 들어가는 화면이라 페이지 제목 없이 설명 + 등록 버튼만 둔다. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          즉시 물품지원부터 반복방문 감지, 읍면동 복지연계, 지속지원 판정까지 관리합니다.
        </p>
        <button
          onClick={openNewClient}
          className="ml-auto flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
        >
          <UserPlus size={16} />
          신규 이용자 등록
        </button>
      </div>

      {/* 통계 카드 — 지표마다 무엇을 뜻하는지 한 줄로 붙인다. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="오늘 이용" value={`${stats.todayCount}건`} icon={Users} description="오늘 방문 접수" />
        <StatCard label="이번 달 이용" value={`${stats.monthCount}건`} icon={CalendarDays} description={stats.monthLabel} />
        <StatCard label="1차 이용" value={`${stats.firstVisitCount}건`} icon={UserPlus} description="신규 이용자 첫 방문" />
        <StatCard label="2차 이상" value={`${stats.repeatVisitCount}건`} icon={RotateCcw} description="반복방문 감지" />
        <StatCard label="복지연계 진행" value={`${stats.referralOngoing}건`} icon={MessageSquare} tone="warning" description="요청 · 읍면동 상담중" />
        <StatCard label="복지연계 완료" value={`${stats.referralDone}건`} icon={CheckCircle2} description="지속지원 판단 대상" />
      </div>

      {/* 검색·필터 바 */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5">
        {/* 검색 */}
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="대상자명 또는 기관명 검색"
            className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
        </label>

        {/* 2차 연계처 필터 */}
        <select
          value={dongFilter}
          onChange={e => setDongFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          <option value="all">전체 연계처</option>
          {DONGS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* 연계상태 필터 */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          <option value="all">전체 연계상태</option>
          {REFERRAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* 우측 버튼 */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleCsv}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <Download size={15} />
            CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <Printer size={15} />
            출력
          </button>
        </div>
      </div>

      {/* 결과 건수 */}
      <div className="flex items-baseline gap-2">
        <p className="text-sm text-slate-600">총 <span className="font-semibold text-slate-900">{filteredRows.length}</span>명</p>
        <p className="text-xs text-slate-400">행을 누르면 진행 단계와 이력을 볼 수 있습니다.</p>
      </div>

      {/* 대상자 목록 테이블 — 개인정보는 마스킹 이름·출생연도·거주 읍면동까지만 */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['연번', '기관명', '방문차수', '대상자', '출생연도', '거주 읍면동', '최근 방문일', '2차 연계처', '기본상담', '연계상태', '다음 조치'].map(col => (
                  <th
                    key={col}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-slate-500"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-sm text-slate-400">
                    검색 조건에 맞는 대상자가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredRows.map(({ client, latestVisit, referral, nextAction }, index) => (
                  <tr
                    key={client.id}
                    onClick={() => setDetailClientId(client.id)}
                    className="cursor-pointer transition-colors hover:bg-teal-50/40"
                  >
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-400">{index + 1}</td>
                    <td className="max-w-[10rem] truncate px-4 py-3.5 text-slate-700">
                      {latestVisit ? SITE_SHORT_NAME.get(latestVisit.siteId) ?? latestVisit.orgName : '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      {latestVisit ? <StageBadge stage={latestVisit.visitStage} /> : '-'}
                      <span className="ml-1.5 text-xs text-slate-400">{client.visitCount}회</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-900">{client.nameMasked}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{client.birthYear}년생</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{client.residenceDong || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{client.lastVisitDate}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{referral?.linkedDong || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <ConductedBadge done={latestVisit?.basicCounseling?.conducted ?? false} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <ReferralBadge status={referral?.status ?? '미연계'} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <NextActionCell label={nextAction.label} tone={nextAction.tone} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 대상자 상세 모달 */}
      {detailRow && (
        <DetailModal
          client={detailRow.client}
          visits={detailRow.visits}
          referral={detailRow.referral}
          onClose={() => setDetailClientId(null)}
          onEdit={() => openEditClient(detailRow.client)}
          onAddVisit={() => openAddVisit(detailRow.client)}
        />
      )}

      {/* 등록/방문추가/수정 모달 */}
      {modalMode && (
        <RecordModal
          mode={modalMode}
          client={targetClient}
          nextVisitNo={nextVisitNo}
          clientForm={clientForm}
          visitForm={visitForm}
          duplicates={duplicates}
          onClientChange={patch => setClientForm(form => ({ ...form, ...patch }))}
          onVisitChange={patch => setVisitForm(form => ({ ...form, ...patch }))}
          onPickDuplicate={openAddVisit}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
