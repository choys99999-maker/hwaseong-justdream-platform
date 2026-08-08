import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FolderClosed, Plus } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import { useDataStore } from '../store/dataStore';
import type { UploadedDataset } from '../store/dataStore';
import {
  derivePeriod,
  deriveRegions,
  formatRegions,
  formatUpdatedAt,
  isSubmittedThisWeek,
  summarizeTypes,
  totalRecordCount,
  type TypeSummary,
} from '../utils/submission';

const MY_REGION_KEY = 'jd-my-region';

interface Submission {
  dataset: UploadedDataset;
  regions: string[];
  period: string | null;
  types: TypeSummary[];
  records: number;
}

export default function DataLibraryPage() {
  const { datasets, activeId, isLoading, clearAll } = useDataStore();
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [myRegion, setMyRegion] = useState(() => localStorage.getItem(MY_REGION_KEY) ?? '');

  const submissions = useMemo<Submission[]>(
    () =>
      [...datasets]
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
        .map((dataset) => ({
          dataset,
          regions: deriveRegions(dataset),
          period: derivePeriod(dataset),
          types: summarizeTypes(dataset),
          records: totalRecordCount(dataset),
        })),
    [datasets],
  );

  const allRegions = useMemo(() => {
    const set = new Set<string>();
    for (const s of submissions) for (const r of s.regions) set.add(r);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [submissions]);

  const allTypes = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of submissions) for (const t of s.types) map.set(t.type, t.label);
    return Array.from(map, ([type, label]) => ({ type, label }));
  }, [submissions]);

  const visible = submissions.filter((s) => {
    // 내 지역을 아직 고르지 않았으면 아무 것도 보여주지 않고 먼저 고르게 한다.
    if (scope === 'mine' && (!myRegion || !s.regions.includes(myRegion))) return false;
    if (typeFilter !== 'all' && !s.types.some((t) => t.type === typeFilter)) return false;
    return true;
  });

  const thisWeekCount = submissions.filter((s) =>
    isSubmittedThisWeek(s.dataset.uploadedAt),
  ).length;

  function selectMyRegion(region: string) {
    setMyRegion(region);
    localStorage.setItem(MY_REGION_KEY, region);
  }

  function handleClearAll() {
    if (window.confirm(`저장된 자료 ${datasets.length}건을 모두 삭제하시겠습니까?`)) {
      clearAll();
    }
  }

  if (isLoading) return null;

  const uploadButton = (
    <Link
      to="/files/upload"
      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
    >
      <Plus size={16} /> 자료 올리기
    </Link>
  );

  return (
    <div className="mx-auto w-full max-w-[1280px]">
      <PageHeader
        title="자료 관리"
        description="지역별 자료를 올리고 제출된 자료를 확인할 수 있습니다."
        actions={uploadButton}
      />

      {submissions.length === 0 ? (
        <EmptyState
          icon={FolderClosed}
          title="아직 제출된 자료가 없습니다"
          message="자료 올리기 버튼을 눌러 표준 양식으로 작성한 Excel 파일을 올려주세요."
        />
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-4">
            <SummaryTile label="전체 자료" value={submissions.length} unit="건" />
            <SummaryTile label="이번 주 제출" value={thisWeekCount} unit="건" />
            <SummaryTile label="반영된 지역" value={allRegions.length} unit="곳" />
          </dl>

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
              <span>지역</span>
              <span>자료</span>
              <span>기간</span>
              <span>상태</span>
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
                {visible.map((s) => {
                  const issues = s.dataset.issueCount ?? 0;
                  return (
                    <li key={s.dataset.id}>
                      <Link
                        to={`/files/${s.dataset.id}`}
                        className="grid grid-cols-[1.3fr_2fr_1fr_1fr_1fr_28px] items-center gap-4 px-5 py-4 text-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium text-slate-800">
                            {formatRegions(s.regions)}
                          </span>
                          {s.dataset.id === activeId && (
                            <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                              열람중
                            </span>
                          )}
                        </span>

                        <span className="min-w-0 truncate text-slate-600">
                          {s.types.length === 0
                            ? '내용 없음'
                            : s.types.map((t) => t.label).join(' · ')}
                          <span className="ml-2 text-xs text-slate-400">
                            {s.records.toLocaleString()}건
                          </span>
                        </span>

                        <span className="text-slate-500">{s.period ?? '—'}</span>

                        <span>
                          {issues > 0 ? (
                            <span className="text-amber-600">확인 필요 {issues.toLocaleString()}건</span>
                          ) : (
                            <span className="text-slate-600">제출완료</span>
                          )}
                        </span>

                        <span className="text-slate-400">
                          {formatUpdatedAt(s.dataset.uploadedAt)}
                        </span>

                        <ChevronRight size={16} className="text-slate-300" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="mt-4 text-right">
            <button
              type="button"
              onClick={handleClearAll}
              className="rounded-lg px-2 py-1 text-xs text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              저장된 자료 전체 삭제
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryTile({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-900">
        {value.toLocaleString()}
        <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>
      </dd>
    </div>
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
