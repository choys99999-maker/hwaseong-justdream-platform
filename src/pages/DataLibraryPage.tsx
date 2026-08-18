import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, BarChart3, ChevronRight, FolderClosed, Plus } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import DataAnalysisView from '../components/analysis/DataAnalysisView';
import {
  Accent,
  ActionRow,
  ActionSection,
  AllClear,
  CARD_CLASS,
  DetailSection,
  HS,
  OverviewSection,
  PageIntro,
  SourceNote,
  SubTabs,
  VizCard,
} from '../components/admin/ui';
import { BigRatioDonut, ProgressRows } from '../components/admin/charts';
import { useCentralData } from '../hooks/useCentralData';
import { listOrganizations, listSubmissions, type RemoteSubmissionSummary } from '../store/remote';
import { districtOfArea } from '../data/districtByArea';
import { REGION_NAMES, REGION_ORDER } from '../data/regionMeta';
import {
  formatPeriod,
  formatUpdatedAt,
  isSubmittedThisWeek,
  type TypeSummary,
} from '../utils/submission';
import type { DistrictId } from '../types';

const MY_REGION_KEY = 'jd-my-region';

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
type LibraryTab = 'missing' | 'issue' | 'all';

/**
 * 자료 관리.
 *
 * 문서 목록이 아니라 **제출 관제 화면**이다. 첫 화면이 답해야 할 질문은 하나다 —
 * "어디가 냈고 어디가 아직인가". 그래서 제출률과 권역별 진행이 먼저 오고,
 * 그 아래에 아직 자료가 필요한 기관이 줄지어 선다. 제출된 자료의 상세 표는
 * [전체 자료] 를 눌렀을 때만 나온다.
 *
 * 매일 쓰지 않는 실적·추이는 예전처럼 [분석](`?tab=analysis`)으로 내려 둔다.
 */
export default function DataLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isAnalysisTab = searchParams.get('tab') === 'analysis';
  const [tab, setTab] = useState<LibraryTab>('missing');
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
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

  /**
   * 미제출 명단 순서. 뒤처진 권역의 기관이 먼저 온다 — [지금 확인할 기관] 위쪽 다섯 곳이
   * 기관 명단에 들어온 순서가 아니라 "먼저 챙겨야 할 곳"이 되도록.
   */
  const missingByPriority = useMemo(() => {
    const rank = new Map<string, number>();
    for (const org of organizations) {
      const key = districtOfArea(org.name) ?? 'unknown';
      const bucket = rank.get(key) ?? 0;
      rank.set(key, bucket + (submittedNames.has(org.name) ? 1 : 0));
    }
    const districtOf = (name: string) => districtOfArea(name) ?? 'unknown';
    return [...missingOrganizations].sort((a, b) => {
      const ra = rank.get(districtOf(a.name)) ?? 0;
      const rb = rank.get(districtOf(b.name)) ?? 0;
      return ra - rb || a.name.localeCompare(b.name, 'ko');
    });
  }, [missingOrganizations, organizations, submittedNames]);

  const issueSubmissions = useMemo(() => submissions.filter((s) => s.issues > 0), [submissions]);
  const issueCount = issueSubmissions.length;
  const thisWeekCount = submissions.filter((s) => isSubmittedThisWeek(s.uploadedAt)).length;

  /**
   * 권역별 제출 진행. 읍면동 이름 → 소속 구는 지도와 같은 경계 데이터를 쓴다
   * (`districtOfArea`) — 여기서 매핑표를 따로 적지 않는다.
   */
  const byDistrict = useMemo(() => {
    const buckets = new Map<DistrictId | 'unknown', { done: number; total: number }>();
    for (const org of organizations) {
      const key = districtOfArea(org.name) ?? 'unknown';
      const bucket = buckets.get(key) ?? { done: 0, total: 0 };
      bucket.total += 1;
      if (submittedNames.has(org.name)) bucket.done += 1;
      buckets.set(key, bucket);
    }
    const rows = REGION_ORDER.filter((id) => buckets.has(id)).map((id) => ({
      key: id as string,
      label: REGION_NAMES[id],
      ...buckets.get(id)!,
    }));
    const unknown = buckets.get('unknown');
    if (unknown) rows.push({ key: 'unknown', label: '구 미확인', ...unknown });
    // 뒤처진 권역이 위로 온다 — 먼저 봐야 할 곳이 먼저 보여야 한다.
    return rows.sort((a, b) => a.done / a.total - b.done / b.total);
  }, [organizations, submittedNames]);

  const allRegions = useMemo(
    () => Array.from(submittedNames).sort((a, b) => a.localeCompare(b, 'ko')),
    [submittedNames],
  );

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

  const uploadButton = (
    <Link
      to="/admin/files/upload"
      className="ad-lift inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#004696] px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#00356F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] focus-visible:ring-offset-2"
    >
      <Plus size={16} /> 자료 올리기
    </Link>
  );

  // ── 분석 화면 — 매일 쓰는 화면이 아니라 별도 모드로 둔다 ──
  if (isAnalysisTab) {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-5">
        <PageHeader
          title="자료 분석"
          description="제출 자료에서 계산한 실적과 추이입니다. 예측이 아니라 올라온 자료의 집계입니다."
          actions={
            <button
              type="button"
              onClick={() => setSearchParams({}, { replace: true })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DFE7EF] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#004696] hover:bg-[#F7FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
            >
              <ArrowLeft size={15} /> 제출 현황으로
            </button>
          }
        />
        <DataAnalysisView />
      </div>
    );
  }

  if (isLoading) return null;

  const submittedCount = submittedNames.size;
  const missingCount = missingOrganizations.length;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <PageIntro
        eyebrow="자료 제출 현황"
        headline={
          missingCount > 0 ? (
            <>
              {organizations.length}개 기관 중 <Accent>{missingCount}곳</Accent>의 자료가 아직 필요합니다
            </>
          ) : (
            <>{organizations.length}개 기관의 자료가 모두 들어왔습니다</>
          )
        }
        description="어디가 제출했고 어디가 아직인지 먼저 확인하고, 올라온 자료는 아래에서 검수합니다."
        actions={
          <>
            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'analysis' }, { replace: true })}
              className="ad-lift inline-flex items-center gap-1.5 rounded-xl border border-[#DFE7EF] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#004696] hover:border-[#C9DCEF] hover:bg-[#F7FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
            >
              <BarChart3 size={15} /> 분석
            </button>
            {uploadButton}
          </>
        }
      />

      {remoteError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{remoteError}</p>
        </div>
      )}

      {organizations.length === 0 && submissions.length === 0 ? (
        <EmptyState
          icon={FolderClosed}
          title="아직 제출된 자료가 없습니다"
          message="자료 올리기 버튼을 눌러 표준 양식으로 작성한 Excel 파일을 올려주세요."
        />
      ) : (
        <>
          {/* ── OVERVIEW — 얼마나 걷혔는가 · 어느 권역이 뒤처지는가 ── */}
          <OverviewSection label="제출 현황 요약">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <VizCard title="전체 제출률" question="전체 기관 중 얼마나 걷혔는가?" delay={40}>
                <div className="flex h-full flex-col items-center justify-center">
                  <BigRatioDonut
                    done={submittedCount}
                    total={organizations.length}
                    doneLabel="제출 완료"
                    color={HS.blue}
                  />
                  <p className="mt-3 text-[12px] text-[#8A96A8]">이번 주 제출 {thisWeekCount}건</p>
                </div>
              </VizCard>

              <VizCard title="권역별 제출 현황" question="어느 권역이 가장 뒤처지는가?" delay={90}>
                <ProgressRows
                  items={byDistrict.map((row) => ({
                    key: row.key,
                    label: row.label,
                    done: row.done,
                    total: row.total,
                  }))}
                />
              </VizCard>
            </div>
          </OverviewSection>

          {/* ── ACTION — 지금 자료를 받아야 할 기관 ── */}
          <ActionSection
            title="지금 확인할 기관"
            hint={
              missingCount > 0
                ? '아직 자료를 내지 않은 기관입니다. 전체 명단은 아래 [미제출] 탭에서 볼 수 있습니다.'
                : undefined
            }
            aside={
              issueCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setTab('issue')}
                  className="text-[12.5px] font-semibold text-[#DC6E2D] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
                >
                  검수에서 오류가 나온 자료 {issueCount}건 →
                </button>
              ) : undefined
            }
          >
            {missingCount === 0 ? (
              <AllClear message="모든 기관이 자료를 제출했습니다." />
            ) : (
              <div className="space-y-2">
                {missingByPriority.slice(0, 5).map((org, i) => {
                  const districtId = districtOfArea(org.name);
                  return (
                    <ActionRow
                      key={org.id}
                      index={i}
                      tone="warning"
                      tag="미제출"
                      title={org.name}
                      detail={`${districtId ? REGION_NAMES[districtId] : org.regionName} · 이번 주 제출 자료 없음`}
                      cta="자료 올리기"
                      as={({ className, style, children }) => (
                        <Link to="/admin/files/upload" className={className} style={style}>
                          {children}
                        </Link>
                      )}
                    />
                  );
                })}
                {missingCount > 5 && (
                  <button
                    type="button"
                    onClick={() => setTab('missing')}
                    className="w-full rounded-xl border border-dashed border-[#DFE7EF] bg-white py-2.5 text-[12.5px] font-medium text-[#004696] transition-colors hover:bg-[#F7FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
                  >
                    미제출 기관 {missingCount}곳 전체 보기 ↓
                  </button>
                )}
              </div>
            )}
          </ActionSection>

          {/* ── DETAIL — 기본은 미제출 명단, 제출된 자료 표는 눌렀을 때만 ── */}
          <DetailSection label="자료 목록">
            <SubTabs
              label="자료 목록 범위"
              value={tab}
              onChange={setTab}
              tabs={[
                { key: 'missing', label: '미제출', count: missingCount },
                { key: 'issue', label: '검토 필요', count: issueCount },
                { key: 'all', label: '전체 자료', count: submissions.length },
              ]}
            />

            <div className="mt-4">
              {tab === 'missing' && <MissingList organizations={missingOrganizations} />}

              {tab === 'issue' &&
                (issueSubmissions.length === 0 ? (
                  <AllClear message="검수에서 오류가 나온 자료가 없습니다." />
                ) : (
                  <SubmissionTable rows={issueSubmissions} />
                ))}

              {tab === 'all' && (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="flex items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-inset ring-[#DFE7EF]">
                      <ScopeTab active={scope === 'all'} onClick={() => setScope('all')}>
                        전체 지역
                      </ScopeTab>
                      <ScopeTab active={scope === 'mine'} onClick={() => setScope('mine')}>
                        내 지역
                      </ScopeTab>
                    </div>

                    {scope === 'mine' && (
                      <label className="flex items-center gap-2 text-[13px] text-[#667085]">
                        <span>내 지역</span>
                        <select
                          aria-label="내 지역 선택"
                          value={myRegion}
                          onChange={(e) => selectMyRegion(e.target.value)}
                          className="rounded-lg border border-[#DFE7EF] bg-white px-3 py-1.5 text-[13px] text-[#182230] focus:outline-none focus:ring-2 focus:ring-[#004696]"
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
                        className="ml-auto rounded-lg border border-[#DFE7EF] bg-white px-3 py-1.5 text-[13px] text-[#182230] focus:outline-none focus:ring-2 focus:ring-[#004696]"
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

                  {visible.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-[#DFE7EF] bg-white px-5 py-12 text-center text-[13px] text-[#98A2B3]">
                      {scope === 'mine' && !myRegion
                        ? '내 지역을 먼저 선택해주세요.'
                        : '조건에 맞는 자료가 없습니다.'}
                    </p>
                  ) : (
                    <SubmissionTable rows={visible} />
                  )}
                </>
              )}
            </div>
          </DetailSection>

          <SourceNote>
            출처: 읍면동 제출 Excel · 기준: 기관별 최신 유효 제출본(재제출로 대체된 자료 제외) · 자료를 열면 읽은
            행 수·인식된 시트 유형·오류 내역을 확인할 수 있습니다.
          </SourceNote>
        </>
      )}
    </div>
  );
}

/** 아직 자료를 내지 않은 기관 명단. 칩 뭉치 대신 권역별로 묶어 읽히게 한다. */
function MissingList({
  organizations,
}: {
  organizations: { id: string; name: string; regionName: string }[];
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const org of organizations) {
      const districtId = districtOfArea(org.name);
      const label = districtId ? REGION_NAMES[districtId] : (org.regionName || '구 미확인');
      const list = map.get(label) ?? [];
      list.push({ id: org.id, name: org.name });
      map.set(label, list);
    }
    return Array.from(map, ([label, orgs]) => ({ label, orgs })).sort(
      (a, b) => b.orgs.length - a.orgs.length,
    );
  }, [organizations]);

  if (organizations.length === 0) {
    return <AllClear message="모든 기관이 자료를 제출했습니다." />;
  }

  return (
    <div className="space-y-3">
      {grouped.map((group, gi) => (
        <div
          key={group.label}
          className={`ad-rise ${CARD_CLASS} p-4`}
          style={{ animationDelay: `${gi * 40}ms` }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[14px] font-semibold text-[#182230]">{group.label}</h3>
            <span className="text-[12.5px] text-[#667085]">
              미제출 <strong className="font-bold text-[#DC6E2D]">{group.orgs.length}</strong>곳
            </span>
          </div>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {group.orgs.map((org) => (
              <li key={org.id}>
                <span className="inline-flex items-center rounded-lg bg-[#FFF6EE] px-2.5 py-1.5 text-[12.5px] font-medium text-[#B4530F]">
                  {org.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** 제출된 자료 표. 예전 화면 그대로다 — 다만 눌러서 들어왔을 때만 나온다. */
function SubmissionTable({ rows }: { rows: SubmissionView[] }) {
  const grid = 'grid grid-cols-[1.3fr_2fr_1fr_1fr_1fr_28px] gap-4';

  return (
    <section className={`overflow-hidden ${CARD_CLASS}`}>
      <div className={`${grid} border-b border-[#EFF3F8] px-5 py-3 text-[11.5px] font-medium text-[#8A96A8]`}>
        <span>제출 기관</span>
        <span>자료 · 읽은 행 수</span>
        <span>기준 기간</span>
        <span>검수 상태</span>
        <span>업데이트</span>
        <span />
      </div>

      <ul className="divide-y divide-[#F3F6FA]">
        {rows.map((s) => (
          <li key={s.id}>
            <Link
              to={`/admin/files/${s.id}`}
              className={`${grid} items-center px-5 py-4 text-[13px] transition-colors hover:bg-[#F7FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#004696]`}
            >
              <span className="min-w-0 truncate font-medium text-[#182230]">{s.regionText}</span>

              <span className="min-w-0 truncate text-[#4C5A6E]">
                {s.types.length === 0 ? '내용 없음' : s.types.map((t) => t.label).join(' · ')}
                <span className="ml-2 text-[11.5px] text-[#8A96A8]">{s.records.toLocaleString()}행</span>
              </span>

              <span className="text-[#667085]">{s.period ?? '—'}</span>

              <span>
                {s.issues > 0 ? (
                  <span className="font-medium text-[#B4530F]">확인 필요 {s.issues.toLocaleString()}건</span>
                ) : (
                  <span className="text-[#667085]">제출완료</span>
                )}
              </span>

              <span className="text-[#8A96A8]">{formatUpdatedAt(s.uploadedAt)}</span>

              <ChevronRight size={16} className="text-[#CBD5E1]" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] ${
        active
          ? 'bg-[#004696] text-white'
          : 'bg-white text-[#667085] ring-1 ring-inset ring-[#DFE7EF] hover:bg-[#F3F6FA]'
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
      className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] ${
        active ? 'bg-[#EAF3FC] text-[#004696]' : 'text-[#667085] hover:text-[#182230]'
      }`}
    >
      {children}
    </button>
  );
}
