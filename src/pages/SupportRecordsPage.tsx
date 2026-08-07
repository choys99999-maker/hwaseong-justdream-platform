import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileUp, Search } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import { useDataStore, getField } from '../store/dataStore';

const PAGE_SIZE = 50;

export default function SupportRecordsPage() {
  const { dataset, isLoading } = useDataStore();
  const [keyword, setKeyword] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [page, setPage] = useState(1);

  const regionCol = getField(dataset, 'region');

  const uniqueRegions = useMemo(() => {
    if (!dataset || !regionCol) return [];
    return Array.from(new Set(dataset.records.map((r) => r[regionCol]).filter(Boolean))).sort();
  }, [dataset, regionCol]);

  const filtered = useMemo(() => {
    if (!dataset) return [];
    const kw = keyword.trim().toLowerCase();
    return dataset.records.filter((row) => {
      const matchesKeyword =
        kw === '' ||
        Object.values(row).some((v) => v.toLowerCase().includes(kw));
      const matchesRegion =
        regionFilter === 'all' || !regionCol || row[regionCol] === regionFilter;
      return matchesKeyword && matchesRegion;
    });
  }, [dataset, keyword, regionFilter, regionCol]);

  const paged = useMemo(
    () => filtered.slice(0, page * PAGE_SIZE),
    [filtered, page],
  );

  if (isLoading && !dataset) return null;
  if (!dataset) {
    return (
      <div className="space-y-6">
        <PageHeader title="이용·지원 내역" description="이용자별 지원 물품과 지원 현황을 확인합니다." />
        <EmptyState
          icon={FileUp}
          title="업로드된 데이터가 없습니다"
          message="데이터 업로드 페이지에서 엑셀 파일을 업로드하면 내역을 확인할 수 있습니다."
        />
        <Link
          to="/upload"
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
        >
          <FileUp size={16} /> 데이터 업로드하러 가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="이용·지원 내역"
        description={`${dataset.fileName} · 총 ${dataset.records.length.toLocaleString()}건`}
      />

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 focus-within:ring-2 focus-within:ring-teal-500">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            placeholder="검색어 입력 (전체 열 대상)"
            className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </label>

        {uniqueRegions.length > 0 && regionCol && (
          <select
            value={regionFilter}
            onChange={(e) => { setRegionFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">전체 {regionCol}</option>
            {uniqueRegions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        )}
      </div>

      <p className="text-sm text-slate-500">
        {filtered.length.toLocaleString()}건
        {filtered.length !== dataset.records.length && ` (전체 ${dataset.records.length.toLocaleString()}건 중)`}
      </p>

      {/* 테이블 */}
      {filtered.length === 0 ? (
        <EmptyState message="검색 조건에 맞는 내역이 없습니다." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {dataset.columns.map((col) => (
                    <th key={col} className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-slate-500">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paged.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    {dataset.columns.map((col) => (
                      <td key={col} className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {row[col] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {paged.length < filtered.length && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                더 보기 ({paged.length.toLocaleString()} / {filtered.length.toLocaleString()}건)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
