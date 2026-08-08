import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileUp, Search } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import { useCentralData } from '../hooks/useCentralData';
import { listRegionUsage, listWelfareLinkage } from '../store/analytics';
import { formatNumber } from '../utils/format';

/**
 * 실적·복지연계 — 화성시 전체가 함께 보는 화면이라 개인 식별 원문 대신
 * 읍면동별 집계(v_region_usage + v_welfare_linkage)를 보여준다.
 * 개인 단위 내역은 해당 지역 상세/자료 상세에서 마스킹된 형태로만 볼 수 있다.
 */
interface Row {
  organizationId: string;
  organizationName: string;
  regionName: string;
  userCount: number;
  basicConsultation: number;
  referralTotal: number;
  linkageCompleted: number;
  referralCount: number;
  visitCount: number;
  consultationDoneCount: number;
  lastConsultDate: string | null;
}

export default function SupportRecordsPage() {
  const [keyword, setKeyword] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');

  const { data, error, isLoading } = useCentralData(
    () =>
      Promise.all([listRegionUsage(), listWelfareLinkage()]).then(([usage, welfare]) => {
        const welfareByOrg = new Map(welfare.map((w) => [w.organizationId, w]));
        return usage.map<Row>((u) => {
          const w = welfareByOrg.get(u.organizationId);
          return {
            organizationId: u.organizationId,
            organizationName: u.organizationName,
            regionName: u.regionName,
            userCount: u.userCount,
            basicConsultation: u.basicConsultation,
            referralTotal: u.referralTotal,
            linkageCompleted: u.linkageCompleted,
            referralCount: w?.referralCount ?? 0,
            visitCount: w?.visitCount ?? 0,
            consultationDoneCount: w?.consultationDoneCount ?? 0,
            lastConsultDate: w?.lastConsultDate ?? null,
          };
        });
      }),
    [],
  );

  const rows = useMemo(() => data ?? [], [data]);

  const regionNames = useMemo(
    () => Array.from(new Set(rows.map((r) => r.regionName))).sort((a, b) => a.localeCompare(b, 'ko')),
    [rows],
  );

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesKeyword =
        kw === '' ||
        r.organizationName.toLowerCase().includes(kw) ||
        r.regionName.toLowerCase().includes(kw);
      const matchesRegion = regionFilter === 'all' || r.regionName === regionFilter;
      return matchesKeyword && matchesRegion;
    });
  }, [rows, keyword, regionFilter]);

  if (isLoading) return null;

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="실적·복지연계" description="읍면동별 실적과 복지 연계 현황을 확인합니다." />
        <EmptyState title="실적을 불러오지 못했습니다" message={error} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="실적·복지연계" description="읍면동별 실적과 복지 연계 현황을 확인합니다." />
        <EmptyState
          icon={FileUp}
          title="업로드된 데이터가 없습니다"
          message="자료 관리에서 Excel 파일을 올리면 내역을 확인할 수 있습니다."
        />
        <Link
          to="/files/upload"
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
        >
          <FileUp size={16} /> 자료 올리기
        </Link>
      </div>
    );
  }

  const totals = filtered.reduce(
    (acc, r) => ({
      users: acc.users + r.userCount,
      consultations: acc.consultations + r.basicConsultation,
      referrals: acc.referrals + r.referralCount,
    }),
    { users: 0, consultations: 0, referrals: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="실적·복지연계"
        description={`${rows.length}개 읍면동 · 중앙 DB 집계 기준`}
      />

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 focus-within:ring-2 focus-within:ring-teal-500">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="읍면동 검색"
            className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </label>

        {regionNames.length > 1 && (
          <select
            aria-label="권역 선택"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">전체 권역</option>
            {regionNames.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
      </div>

      <p className="text-sm text-slate-500">
        {filtered.length.toLocaleString()}개 읍면동 · 이용자 {formatNumber(totals.users)}명 · 기본
        상담 {formatNumber(totals.consultations)}건 · 복지 연계 {formatNumber(totals.referrals)}건
      </p>

      {filtered.length === 0 ? (
        <EmptyState message="검색 조건에 맞는 내역이 없습니다." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-slate-500">
                  읍면동
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-slate-500">
                  권역
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-medium text-slate-500">
                  이용자
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-medium text-slate-500">
                  기본 상담
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-medium text-slate-500">
                  연계 의뢰
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-medium text-slate-500">
                  연계 완료
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-medium text-slate-500">
                  복지 연계 건수
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-medium text-slate-500">
                  최근 상담일
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((r) => (
                <tr key={r.organizationId} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">
                    <Link
                      to={`/regions/${encodeURIComponent(r.organizationName)}`}
                      className="hover:text-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      {r.organizationName}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{r.regionName}</td>
                  <td className="px-4 py-3 text-center text-slate-700">
                    {formatNumber(r.userCount)}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700">
                    {formatNumber(r.basicConsultation)}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700">
                    {formatNumber(r.referralTotal)}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700">
                    {formatNumber(r.linkageCompleted)}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700">
                    {formatNumber(r.referralCount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center text-slate-500">
                    {r.lastConsultDate ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
