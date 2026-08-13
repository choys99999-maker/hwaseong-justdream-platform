import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ChevronRight,
  Database,
  FileSpreadsheet,
  FolderClosed,
  Plus,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import { useCentralData } from '../hooks/useCentralData';
import { listOrganizations, listSubmissions, type RemoteSubmissionSummary } from '../store/remote';
import {
  formatPeriod,
  formatUpdatedAt,
  isSubmittedThisWeek,
  type TypeSummary,
} from '../utils/submission';

const MY_REGION_KEY = 'jd-my-region';

/** 자료 처리 흐름 — 현재 실제 구현(Excel 업로드 파이프라인)을 그대로 시각화한 것뿐, 새 단계 아님 */
const PROCESS_STEPS = [
  { label: '기관 자료', icon: FileSpreadsheet },
  { label: '자동 인식', icon: ScanSearch },
  { label: '오류 검증', icon: ShieldCheck },
  { label: '공통 형식 변환', icon: RefreshCw },
  { label: '중앙 집계', icon: Database },
] as const;

/** 목록 한 줄. 중앙 DB의 유효 제출본만 들어온다. */
interface SubmissionView {
  id: string;
  regionText: string;
  regions: string[];
  period: string | null;
  types: TypeSummary[];
  records: number;
  issues: number;
  uploadedAt: string;
}

function fromRemote(s: RemoteSubmissionSummary): SubmissionView {
  return {
    id: s.id,
    regionText: s.organizationName,
    regions: [s.organizationName],
    period: s.periodStart && s.periodEnd ? formatPeriod(s.periodStart, s.periodEnd) : null,
    types: s.types,
    records: s.recordCount,
    issues: s.issueCount,
    uploadedAt: s.uploadedAt,
  };
}

type StatusFilter = 'all' | 'ok' | 'issue';

export default function DataLibraryPage() {
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showMissingList, setShowMissingList] = useState(false);
  const [myRegion, setMyRegion] = useState(() => localStorage.getItem(MY_REGION_KEY) ?? '');

  // 제출 자료와 함께 전체 기관 명단을 읽어 "누가 아직 안 냈는지"까지 보여준다.
  const { data: remote, error: remoteError, isLoading } = useCentralData(
    () =>
      Promise.all([listSubmissions(), listOrganizations()]).then(([submissions, organizations]) => ({
        submissions,
        organizations,
      })),
    [],
  );

  const submissions = useMemo<SubmissionView[]>(
    () => (remote?.submissions ?? []).map(fromRemote),
    [remote],
  );
  const organizations = useMemo(() => remote?.organizations ?? [], [remote]);

  // 제출/미제출은 기관 명단(organizations) 기준으로 가른다.
  const submittedNames = useMemo(() => {
    const set = new Set<string>();
    for (const s of submissions) for (const r of s.regions) set.add(r);
    return set;
  }, [submissions]);

  const missingOrganizations = useMemo(
    () => organizations.filter((org) => !submittedNames.has(org.name)),
    [organizations, submittedNames],
  );

  const issueCount = submissions.filter((s) => s.issues > 0).length;
  const thisWeekCount = submissions.filter((s) => isSubmittedThisWeek(s.uploadedAt)).length;

  const allRegions = useMemo(() => Array.from(submittedNames).sort((a, b) => a.localeCompare(b, 'ko')), [submittedNames]);

  const allTypes = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of submissions) for (const t of s.types) map.set(t.type, t.label);
    return Array.from(map, ([type, label]) => ({ type, label }));
  }, [submissions]);

  const visible = submissions.filter((s) => {
    // 내 지역을 아직 고르지 않았으면 아무 것도 보여주지 않고 먼저 고르게 한다.
    if (scope === 'mine' && (!myRegion || !s.regions.includes(myRegion))) return false;
    if (typeFilter !== 'all' && !s.types.some((t) => t.type === typeFilter)) return false;
    if (statusFilter === 'ok' && s.issues > 0) return false;
    if (statusFilter === 'issue' && s.issues === 0) return false;
    return true;
  });

  function selectMyRegion(region: string) {
    setMyRegion(region);
    localStorage.setItem(MY_REGION_KEY, region);
  }

  if (isLoading) return null;

  const uploadButton = (
    <Link
      to="/admin/files/upload"
      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
    >
      <Plus size={16} /> 자료 올리기
    </Link>
  );

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader
        title="자료·데이터 관리"
        description="읍면동 제출 자료를 수집·검수하는 허브입니다. 여기서 저장된 자료가 대시보드·재고·실적 화면의 기준이 됩니다."
        actions={uploadButton}
      />

      {/* 자료 처리 흐름 — 새 기능이 아니라 현재 Excel 파이프라인을 시각화한 것 */}
      <section
        aria-label="자료 처리 흐름"
        className="mb-4 flex items-center gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white px-4 py-3"
      >
        {PROCESS_STEPS.map((step, index) => (
          <div key={step.label} className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                <step.icon size={13} />
              </span>
              <span className="whitespace-nowrap text-xs font-medium text-slate-700">{step.label}</span>
            </div>
            {index < PROCESS_STEPS.length - 1 && (
              <ChevronRight size={14} className="shrink-0 text-slate-300" />
            )}
          </div>
        ))}
      </section>

      {remoteError && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{remoteError}</p>
        </div>
      )}

      {/* 제출 현황 요약 — 전체 기관 대비 어디까지 걷혔는지 */}
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryTile label="전체 기관" value={organizations.length} unit="곳" hint="자료 제출 대상 읍면동" />
        <SummaryTile
          label="제출 완료"
          value={submittedNames.size}
          unit="곳"
          hint={`이번 주 제출 ${thisWeekCount.toLocaleString()}건`}
          tone="teal"
        />
        <button
          type="button"
          onClick={() => setShowMissingList((v) => !v)}
          disabled={missingOrganizations.length === 0}
          aria-expanded={showMissingList}
          className={`rounded-xl border px-5 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
            missingOrganizations.length === 0
              ? 'cursor-default border-slate-200 bg-white'
              : showMissingList
                ? 'border-amber-400 bg-amber-50 ring-1 ring-inset ring-amber-400'
                : 'border-amber-200 bg-white hover:border-amber-300 hover:bg-amber-50/40'
          }`}
        >
          <span className="text-sm text-slate-500">미제출</span>
          <span className="mt-1.5 block text-[28px] font-bold leading-none tabular-nums text-slate-900">
            {missingOrganizations.length.toLocaleString()}
            <span className="ml-1 text-sm font-normal text-slate-400">곳</span>
          </span>
          <span className="mt-0.5 block text-xs text-amber-700">
            {missingOrganizations.length === 0 ? '전 기관 제출 완료' : showMissingList ? '명단 접기' : '명단 보기'}
          </span>
        </button>
        <SummaryTile
          label="검토 필요"
          value={issueCount}
          unit="건"
          hint="값 오류가 발견된 제출 자료"
          tone={issueCount > 0 ? 'amber' : 'default'}
        />
      </dl>

      {/* 미제출 기관 명단 */}
      {showMissingList && missingOrganizations.length > 0 && (
        <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3" aria-label="미제출 기관 명단">
          <p className="text-xs font-medium text-amber-800">아직 자료를 제출하지 않은 기관</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {missingOrganizations.map((org) => (
              <li
                key={org.id}
                className="rounded-md bg-white px-2 py-1 text-xs text-slate-600 ring-1 ring-inset ring-amber-200"
              >
                {org.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {submissions.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={FolderClosed}
            title="아직 제출된 자료가 없습니다"
            message="자료 올리기 버튼을 눌러 표준 양식으로 작성한 Excel 파일을 올려주세요."
          />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <ScopeTab active={scope === 'all'} onClick={() => setScope('all')}>
                전체 지역
              </ScopeTab>
              <ScopeTab active={scope === 'mine'} onClick={() => setScope('mine')}>
                내 지역
              </ScopeTab>
            </div>

            {scope === 'mine' && (
              <label className="flex items-center gap-2 text-sm text-slate-500">
                <span>내 지역</span>
                <select
                  aria-label="내 지역 선택"
                  value={myRegion}
                  onChange={(e) => selectMyRegion(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">선택해주세요</option>
                  {allRegions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* 상태 필터 */}
            <div className="flex items-center gap-1.5" role="group" aria-label="상태 필터">
              <StatusChip label="전체" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
              <StatusChip label="제출완료" active={statusFilter === 'ok'} onClick={() => setStatusFilter('ok')} />
              <StatusChip
                label={`검토 필요 ${issueCount}`}
                active={statusFilter === 'issue'}
                onClick={() => setStatusFilter('issue')}
              />
            </div>

            {allTypes.length > 1 && (
              <select
                aria-label="자료 유형"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">전체 자료 유형</option>
                {allTypes.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="grid grid-cols-[1.3fr_2fr_1fr_1fr_1fr_28px] gap-4 border-b border-slate-100 px-5 py-3 text-xs font-medium text-slate-400">
              <span>제출 기관</span>
              <span>자료 · 읽은 행 수</span>
              <span>기준 기간</span>
              <span>검수 상태</span>
              <span>업데이트</span>
              <span />
            </div>

            {visible.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-slate-400">
                {scope === 'mine' && !myRegion
                  ? '내 지역을 먼저 선택해주세요.'
                  : '조건에 맞는 자료가 없습니다.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-50">
                {visible.map((s) => (
                  <li key={s.id}>
                    <Link
                      to={`/admin/files/${s.id}`}
                      className="grid grid-cols-[1.3fr_2fr_1fr_1fr_1fr_28px] items-center gap-4 px-5 py-4 text-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-slate-800">{s.regionText}</span>
                      </span>

                      <span className="min-w-0 truncate text-slate-600">
                        {s.types.length === 0
                          ? '내용 없음'
                          : s.types.map((t) => t.label).join(' · ')}
                        <span className="ml-2 text-xs text-slate-400">
                          {s.records.toLocaleString()}행
                        </span>
                      </span>

                      <span className="text-slate-500">{s.period ?? '—'}</span>

                      <span>
                        {s.issues > 0 ? (
                          <span className="text-amber-600">
                            확인 필요 {s.issues.toLocaleString()}건
                          </span>
                        ) : (
                          <span className="text-slate-600">제출완료</span>
                        )}
                      </span>

                      <span className="text-slate-400">{formatUpdatedAt(s.uploadedAt)}</span>

                      <ChevronRight size={16} className="text-slate-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="mt-3 text-xs text-slate-400">
            출처: 읍면동 제출 Excel · 기준: 기관별 최신 유효 제출본(재제출로 대체된 자료 제외) · 자료를 열면 읽은 행
            수·인식된 시트 유형·오류 내역을 확인할 수 있습니다.
          </p>
        </>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  unit,
  hint,
  tone = 'default',
}: {
  label: string;
  value: number;
  unit: string;
  hint?: string;
  tone?: 'default' | 'teal' | 'amber';
}) {
  return (
    <div
      className={`rounded-xl border px-5 py-4 ${
        tone === 'amber' ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white'
      }`}
    >
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1.5 text-[28px] font-bold leading-none tabular-nums text-slate-900">
        {value.toLocaleString()}
        <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>
      </dd>
      {hint && (
        <p className={`mt-0.5 text-xs ${tone === 'teal' ? 'text-teal-600' : tone === 'amber' ? 'text-amber-700' : 'text-slate-400'}`}>
          {hint}
        </p>
      )}
    </div>
  );
}

function StatusChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
        active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}

function ScopeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}
