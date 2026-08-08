import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileUp, Search } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import { useCentralData } from '../hooks/useCentralData';
import { listInventoryStatus } from '../store/analytics';
import { formatNumber } from '../utils/format';

export default function InventoryPage() {
  const [keyword, setKeyword] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');

  // 여러 기관의 최신 재고를 한 번에 읽는다.
  // 입고/출고는 기간 합계, 현재재고·유통기한은 최신 제출본 기준 — 판단 로직은 전부 view에 있다.
  const { data, error, isLoading } = useCentralData(() => listInventoryStatus(), []);

  const items = useMemo(() => data ?? [], [data]);

  const regionNames = useMemo(
    () =>
      Array.from(new Set(items.map((i) => i.regionName))).sort((a, b) => a.localeCompare(b, 'ko')),
    [items],
  );

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return items.filter((i) => {
      const matchesKeyword =
        kw === '' ||
        i.itemName.toLowerCase().includes(kw) ||
        i.organizationName.toLowerCase().includes(kw);
      const matchesRegion = regionFilter === 'all' || i.regionName === regionFilter;
      return matchesKeyword && matchesRegion;
    });
  }, [items, keyword, regionFilter]);

  if (isLoading) return null;

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="물품·재고 관리" description="지원 물품별 배부 현황을 확인합니다." />
        <EmptyState title="재고 현황을 불러오지 못했습니다" message={error} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="물품·재고 관리" description="지원 물품별 배부 현황을 확인합니다." />
        <EmptyState
          icon={FileUp}
          title="업로드된 데이터가 없습니다"
          message="자료 관리에서 Excel 파일을 올리면 품목 현황을 확인할 수 있습니다."
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

  const totalStock = filtered.reduce((sum, i) => sum + i.stock, 0);
  const alertCount = filtered.filter((i) => i.isExpiringSoon || i.isExpired).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="물품·재고 관리"
        description={`${new Set(items.map((i) => i.organizationId)).size}개 기관 · ${items.length}개 품목`}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-teal-500">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="품목명 · 기관 검색"
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
        총 {filtered.length}건 · 현재재고 {formatNumber(totalStock)}개
        {alertCount > 0 && ` · 유통기한 확인 필요 ${alertCount}건`}
      </p>

      {filtered.length === 0 ? (
        <EmptyState message="검색 조건에 맞는 품목이 없습니다." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-slate-500">
                  품목명
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-slate-500">
                  기관
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-medium text-slate-500">
                  입고
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-medium text-slate-500">
                  출고
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-medium text-slate-500">
                  현재재고
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-medium text-slate-500">
                  유통기한
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-medium text-slate-500">
                  상태
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((i) => (
                <tr key={`${i.organizationId}-${i.itemName}`} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">
                    {i.itemName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {i.organizationName}
                    <span className="ml-2 text-xs text-slate-400">{i.regionName}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700">
                    {formatNumber(i.inboundQuantity)}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700">
                    {formatNumber(i.outboundQuantity)}
                  </td>
                  <td className="px-4 py-3 text-center font-medium text-slate-800">
                    {formatNumber(i.stock)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center text-slate-500">
                    {i.expirationDate ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {i.isExpired ? (
                      <StatusBadge status="확인 필요" />
                    ) : i.isExpiringSoon ? (
                      <StatusBadge status="임박" />
                    ) : (
                      <StatusBadge status="정상" />
                    )}
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
