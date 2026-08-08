import { useMemo, useState } from 'react';
import {
  Search, Users, CalendarDays, UserPlus, RotateCcw,
  MessageSquare, CheckCircle2, Download, Printer, Plus,
  X, Edit2, Clock,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import type { CounselingRecord, LinkageStatus, VisitType, LinkageConductedFlag, RegionId } from '../types';
import { mockCounselingRecords as seedData } from '../data/mockCounselingRecords';

// ─── 날짜 상수 ────────────────────────────────────────────────────────────────
const TODAY = '2026-08-09';
const THIS_MONTH_PREFIX = '2026-08';

// ─── 읍면동 목록 ──────────────────────────────────────────────────────────────
const DONGS = [
  '남양읍', '향남읍', '우정읍', '팔탄면', '마도면', '송산면',
  '서신면', '비봉면', '매송면', '봉담읍',
  '병점1동', '병점2동', '기배동', '화산동', '진안동', '반정동', '오산동',
  '동탄1동', '동탄2동', '동탄3동', '동탄4동', '동탄5동', '동탄6동', '동탄7동', '동탄8동',
];

const LINKAGE_STATUSES: LinkageStatus[] = ['연계완료', '검토중', '연계불요', '기타'];

const ORG_OPTIONS = [
  '남양읍 행정복지센터', '팔탄면 행정복지센터',
  '향남읍 행정복지센터', '봉담읍 행정복지센터',
  '병점1동 행정복지센터', '화산동 행정복지센터',
  '동탄4동 행정복지센터', '동탄6동 행정복지센터',
];

const ORG_REGION_MAP: Record<string, RegionId> = {
  '남양읍 행정복지센터': 'manse', '팔탄면 행정복지센터': 'manse',
  '향남읍 행정복지센터': 'hyohaeng', '봉담읍 행정복지센터': 'hyohaeng',
  '병점1동 행정복지센터': 'byeongjeom', '화산동 행정복지센터': 'byeongjeom',
  '동탄4동 행정복지센터': 'dongtan', '동탄6동 행정복지센터': 'dongtan',
};

// ─── 배지 컴포넌트 ─────────────────────────────────────────────────────────────
const LINKAGE_BADGE: Record<LinkageStatus, string> = {
  '연계완료': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  '검토중':   'bg-amber-50  text-amber-700  ring-amber-600/20',
  '연계불요': 'bg-slate-100 text-slate-600  ring-slate-500/20',
  '기타':     'bg-sky-50    text-sky-700    ring-sky-600/20',
};

function LinkageBadge({ status }: { status: LinkageStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${LINKAGE_BADGE[status]}`}>
      {status}
    </span>
  );
}

function VisitBadge({ type }: { type: VisitType }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
      type === '최초방문'
        ? 'bg-teal-50 text-teal-700 ring-teal-600/20'
        : 'bg-violet-50 text-violet-700 ring-violet-600/20'
    }`}>
      {type}
    </span>
  );
}

function ConductedBadge({ flag }: { flag: LinkageConductedFlag }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
      flag === 'O'
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
        : 'bg-slate-100 text-slate-500 ring-slate-400/20'
    }`}>
      {flag}
    </span>
  );
}

// ─── 폼 타입 ─────────────────────────────────────────────────────────────────
interface RecordForm {
  orgName: string;
  clientName: string;
  birthDate: string;
  address: string;
  visitType: VisitType;
  counselingDate: string;
  secondReferralDong: string;
  linkageConducted: LinkageConductedFlag;
  linkageStatus: LinkageStatus;
  linkageService: string;
  note: string;
}

const DEFAULT_FORM: RecordForm = {
  orgName: '', clientName: '', birthDate: '', address: '',
  visitType: '최초방문', counselingDate: TODAY,
  secondReferralDong: '', linkageConducted: 'O',
  linkageStatus: '검토중', linkageService: '', note: '',
};

// ─── CSV 다운로드 ─────────────────────────────────────────────────────────────
function downloadCSV(records: CounselingRecord[]) {
  const headers = ['연번', '기관명', '방문구분', '대상자', '생년월일', '주소', '상담일자', '2차 연계처', '연계상담', '연계상태'];
  const rows = records.map(r => [
    r.seq, `"${r.orgName}"`, r.visitType, r.clientName,
    r.birthDate, `"${r.address}"`, r.counselingDate,
    r.secondReferralDong, r.linkageConducted, r.linkageStatus,
  ]);
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '이용자상담복지연계관리.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── 대상자 상세 모달 ──────────────────────────────────────────────────────────
function DetailModal({
  record,
  onClose,
  onEdit,
}: {
  record: CounselingRecord;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">대상자 상세 정보</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <Edit2 size={13} />
              수정
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {/* 기본 정보 */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">기본 정보</h3>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 rounded-xl bg-slate-50 p-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">기관명</p>
                <p className="mt-0.5 font-medium text-slate-800">{record.orgName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">방문구분</p>
                <p className="mt-1"><VisitBadge type={record.visitType} /></p>
              </div>
              <div>
                <p className="text-xs text-slate-500">대상자</p>
                <p className="mt-0.5 font-medium text-slate-800">{record.clientName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">생년월일</p>
                <p className="mt-0.5 text-slate-800">{record.birthDate}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-500">주소</p>
                <p className="mt-0.5 text-slate-800">{record.address}</p>
              </div>
            </div>
          </section>

          {/* 회차별 이력 타임라인 */}
          <section>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
              이용/상담/복지연계 이력
            </h3>
            <div className="space-y-0">
              {record.history.map((visit, idx) => {
                const isLast = idx === record.history.length - 1;
                return (
                  <div key={idx} className="relative flex gap-4">
                    {/* 타임라인 축 */}
                    <div className="flex flex-col items-center">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isLast
                          ? 'bg-teal-100 text-teal-700 ring-2 ring-teal-300'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {visit.visitNo}
                      </div>
                      {!isLast && (
                        <div className="mt-1 w-0.5 grow bg-slate-200" />
                      )}
                    </div>

                    {/* 내용 */}
                    <div className={`flex-1 ${!isLast ? 'pb-5' : 'pb-1'}`}>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <VisitBadge type={visit.visitType} />
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Clock size={11} />
                          {visit.visitDate}
                        </span>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs space-y-1.5">
                        <div className="flex items-center gap-3">
                          <span className="w-16 shrink-0 text-slate-400">연계상담</span>
                          <ConductedBadge flag={visit.linkageConducted} />
                        </div>
                        {visit.secondReferralDong && (
                          <div className="flex items-center gap-3">
                            <span className="w-16 shrink-0 text-slate-400">2차 연계처</span>
                            <span className="text-slate-700">{visit.secondReferralDong}</span>
                          </div>
                        )}
                        {visit.linkageStatus && (
                          <div className="flex items-center gap-3">
                            <span className="w-16 shrink-0 text-slate-400">연계상태</span>
                            <LinkageBadge status={visit.linkageStatus} />
                          </div>
                        )}
                        {visit.linkageService && (
                          <div className="flex items-center gap-3">
                            <span className="w-16 shrink-0 text-slate-400">복지서비스</span>
                            <span className="font-medium text-teal-700">{visit.linkageService}</span>
                          </div>
                        )}
                        {visit.counselingNote && (
                          <p className="mt-1 border-t border-slate-100 pt-1.5 italic text-slate-500">
                            "{visit.counselingNote}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 복지연계 상세 */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">상담/복지연계 상세</h3>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 rounded-xl bg-slate-50 p-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">2차 연계처</p>
                <p className="mt-0.5 font-medium text-slate-800">{record.secondReferralDong}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">연계상담 실시</p>
                <p className="mt-1"><ConductedBadge flag={record.linkageConducted} /></p>
              </div>
              {record.linkageService && (
                <div>
                  <p className="text-xs text-slate-500">연계 서비스</p>
                  <p className="mt-0.5 font-medium text-teal-700">{record.linkageService}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500">최종 연계 상태</p>
                <p className="mt-1"><LinkageBadge status={record.linkageStatus} /></p>
              </div>
              {record.note && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-500">기타 내역</p>
                  <p className="mt-0.5 text-slate-700">{record.note}</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── 등록/수정 모달 ───────────────────────────────────────────────────────────
function RegisterModal({
  isEdit,
  form,
  onChange,
  onSave,
  onClose,
}: {
  isEdit: boolean;
  form: RecordForm;
  onChange: (patch: Partial<RecordForm>) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const canSave = Boolean(form.orgName && form.clientName && form.counselingDate);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {isEdit ? '상담/복지연계 기록 수정' : '상담/복지연계 기록 등록'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {/* 기관명 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              기관명 <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.orgName}
              onChange={e => onChange({ orgName: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">기관을 선택하세요</option>
              {ORG_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* 대상자명 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              대상자명 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.clientName}
              onChange={e => onChange({ clientName: e.target.value })}
              placeholder="예: 홍○동 (성 + 이름 가운데 ○ 처리)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* 생년월일 + 방문구분 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">생년월일</label>
              <input
                type="date"
                value={form.birthDate}
                onChange={e => onChange({ birthDate: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                방문구분 <span className="text-rose-500">*</span>
              </label>
              <div className="flex h-[38px] items-center gap-5 rounded-lg border border-slate-200 px-3">
                {(['최초방문', '재방문'] as const).map(t => (
                  <label key={t} className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="radio" name="visitType" value={t}
                      checked={form.visitType === t}
                      onChange={() => onChange({ visitType: t })}
                      className="accent-teal-600"
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 주소 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">주소</label>
            <input
              type="text"
              value={form.address}
              onChange={e => onChange({ address: e.target.value })}
              placeholder="화성시 ○○읍 ○○로 00"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* 상담일자 + 2차 연계처 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                상담(방문)일자 <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={form.counselingDate}
                onChange={e => onChange({ counselingDate: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">2차 연계처 (읍면동)</label>
              <select
                value={form.secondReferralDong}
                onChange={e => onChange({ secondReferralDong: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">읍면동 선택</option>
                {DONGS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* 연계상담 실시 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">연계상담 실시 여부</label>
            <div className="flex gap-6">
              {(['O', 'X'] as const).map(v => (
                <label key={v} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio" name="linkageConducted" value={v}
                    checked={form.linkageConducted === v}
                    onChange={() => onChange({ linkageConducted: v })}
                    className="accent-teal-600"
                  />
                  {v === 'O' ? '실시 (O)' : '미실시 (X)'}
                </label>
              ))}
            </div>
          </div>

          {/* 연계 상태 + 복지서비스 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">연계 상태</label>
              <select
                value={form.linkageStatus}
                onChange={e => onChange({ linkageStatus: e.target.value as LinkageStatus })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {LINKAGE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">복지연계 서비스</label>
              <input
                type="text"
                value={form.linkageService}
                onChange={e => onChange({ linkageService: e.target.value })}
                placeholder="예: 통합돌봄, 반찬지원"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* 기타 내역 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">기타 내역</label>
            <textarea
              value={form.note}
              onChange={e => onChange({ note: e.target.value })}
              rows={3}
              placeholder="특이사항, 추후 계획 등을 입력하세요"
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-2 pt-1">
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
              {isEdit ? '수정 완료' : '등록'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function SupportRecordsPage() {
  const [records, setRecords] = useState<CounselingRecord[]>(seedData);
  const [keyword, setKeyword] = useState('');
  const [dongFilter, setDongFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRecord, setSelectedRecord] = useState<CounselingRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<CounselingRecord | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [form, setForm] = useState<RecordForm>(DEFAULT_FORM);

  // 통계 (전체 레코드 기준)
  const stats = useMemo(() => ({
    todayCount:     records.filter(r => r.counselingDate === TODAY).length,
    monthCount:     records.filter(r => r.counselingDate.startsWith(THIS_MONTH_PREFIX)).length,
    newCount:       records.filter(r => r.visitType === '최초방문').length,
    revisitCount:   records.filter(r => r.visitType === '재방문').length,
    conductedCount: records.filter(r => r.linkageConducted === 'O').length,
    completedCount: records.filter(r => r.linkageStatus === '연계완료').length,
  }), [records]);

  // 필터링
  const filteredRecords = useMemo(() => {
    const kw = keyword.trim();
    return records.filter(r => {
      const matchesKw = kw === '' || r.clientName.includes(kw) || r.orgName.includes(kw);
      const matchesDong = dongFilter === 'all' || r.secondReferralDong === dongFilter;
      const matchesStatus = statusFilter === 'all' || r.linkageStatus === statusFilter;
      return matchesKw && matchesDong && matchesStatus;
    });
  }, [records, keyword, dongFilter, statusFilter]);

  // 등록 모달 열기
  const openNew = () => {
    setEditingRecord(null);
    setForm(DEFAULT_FORM);
    setShowRegisterModal(true);
  };

  // 수정 모달 열기
  const openEdit = (record: CounselingRecord) => {
    setEditingRecord(record);
    setForm({
      orgName: record.orgName,
      clientName: record.clientName,
      birthDate: record.birthDate,
      address: record.address,
      visitType: record.visitType,
      counselingDate: record.counselingDate,
      secondReferralDong: record.secondReferralDong,
      linkageConducted: record.linkageConducted,
      linkageStatus: record.linkageStatus,
      linkageService: record.linkageService ?? '',
      note: record.note ?? '',
    });
    setSelectedRecord(null);
    setShowRegisterModal(true);
  };

  // 저장
  const handleSave = () => {
    if (!form.orgName || !form.clientName || !form.counselingDate) return;

    if (editingRecord) {
      setRecords(prev => prev.map(r =>
        r.id !== editingRecord.id ? r : {
          ...r,
          orgName: form.orgName,
          clientName: form.clientName,
          birthDate: form.birthDate,
          address: form.address,
          visitType: form.visitType,
          counselingDate: form.counselingDate,
          secondReferralDong: form.secondReferralDong,
          linkageConducted: form.linkageConducted,
          linkageStatus: form.linkageStatus,
          linkageService: form.linkageService || undefined,
          note: form.note || undefined,
        }
      ));
    } else {
      const newRecord: CounselingRecord = {
        id: `cr-new-${Date.now()}`,
        seq: records.length + 1,
        orgName: form.orgName,
        regionId: ORG_REGION_MAP[form.orgName] ?? 'manse',
        clientName: form.clientName,
        birthDate: form.birthDate,
        address: form.address,
        visitType: form.visitType,
        counselingDate: form.counselingDate,
        secondReferralDong: form.secondReferralDong,
        linkageConducted: form.linkageConducted,
        linkageStatus: form.linkageStatus,
        linkageService: form.linkageService || undefined,
        note: form.note || undefined,
        history: [{
          visitNo: 1,
          visitDate: form.counselingDate,
          visitType: form.visitType,
          linkageConducted: form.linkageConducted,
          linkageStatus: form.linkageStatus,
          linkageService: form.linkageService || undefined,
          secondReferralDong: form.secondReferralDong,
        }],
      };
      setRecords(prev => [newRecord, ...prev]);
    }
    setShowRegisterModal(false);
  };

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <PageHeader
        title="이용자·상담 관리"
        description="화성시 그냥드림 이용자의 방문, 상담, 복지연계 현황을 통합 관리합니다."
        actions={
          <button
            onClick={openNew}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          >
            <Plus size={16} />
            상담/복지연계 기록 등록
          </button>
        }
      />

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="오늘 이용자" value={`${stats.todayCount}명`} icon={Users} />
        <StatCard label="이번 달 이용자" value={`${stats.monthCount}명`} icon={CalendarDays} />
        <StatCard label="신규(최초) 방문" value={`${stats.newCount}명`} icon={UserPlus} />
        <StatCard label="재방문" value={`${stats.revisitCount}명`} icon={RotateCcw} />
        <StatCard label="연계상담 실시" value={`${stats.conductedCount}건`} icon={MessageSquare} tone="warning" />
        <StatCard label="복지연계 완료" value={`${stats.completedCount}건`} icon={CheckCircle2} tone="warning" />
      </div>

      {/* 검색·필터 바 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        {/* 검색 */}
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-teal-500">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="대상자명 또는 기관명 검색"
            className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </label>

        {/* 2차 연계처 필터 */}
        <select
          value={dongFilter}
          onChange={e => setDongFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">전체 연계처</option>
          {DONGS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* 연계상태 필터 */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">전체 연계상태</option>
          {LINKAGE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* 우측 버튼 */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => downloadCSV(filteredRecords)}
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
      <p className="text-sm text-slate-500">총 {filteredRecords.length}건</p>

      {/* 대상자 목록 테이블 */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['연번', '기관명', '방문구분', '대상자', '생년월일', '주소', '상담일자', '2차 연계처', '연계상담', '연계상태'].map(col => (
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
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-sm text-slate-400">
                    검색 조건에 맞는 대상자가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(record => (
                  <tr
                    key={record.id}
                    onClick={() => setSelectedRecord(record)}
                    className="cursor-pointer transition-colors hover:bg-teal-50/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">{record.seq}</td>
                    <td className="max-w-[9rem] truncate px-4 py-3 font-medium text-slate-800">{record.orgName}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <VisitBadge type={record.visitType} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{record.clientName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{record.birthDate}</td>
                    <td className="max-w-[9rem] truncate px-4 py-3 text-slate-600">{record.address}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{record.counselingDate}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{record.secondReferralDong}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <ConductedBadge flag={record.linkageConducted} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <LinkageBadge status={record.linkageStatus} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 대상자 상세 모달 */}
      {selectedRecord && (
        <DetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onEdit={() => openEdit(selectedRecord)}
        />
      )}

      {/* 등록/수정 모달 */}
      {showRegisterModal && (
        <RegisterModal
          isEdit={Boolean(editingRecord)}
          form={form}
          onChange={patch => setForm(f => ({ ...f, ...patch }))}
          onSave={handleSave}
          onClose={() => setShowRegisterModal(false)}
        />
      )}
    </div>
  );
}
