import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileUp, Search } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import { useDataStore, getField } from '../store/dataStore';
import { formatNumber } from '../utils/format';

export default function InventoryPage() {
  const { dataset, isLoading } = useDataStore();
  const [keyword, setKeyword] = useState('');

  const itemCol = getField(dataset, 'item');
  const qtyCol = getField(dataset, 'quantity');
  const regionCol = getField(dataset, 'region');

  const itemStats = useMemo(() => {
    if (!dataset || !itemCol) return [];
    const map = new Map<string, { count: number; totalQty: number; regions: Set<string> }>();
    for (const r of dataset.records) {
      const name = r[itemCol] ?? '';
      if (!name) continue;
      if (!map.has(name)) map.set(name, { count: 0, totalQty: 0, regions: new Set() });
      const entry = map.get(name)!;
      entry.count++;
      if (qtyCol) entry.totalQty += parseInt(r[qtyCol] ?? '0', 10) || 0;
      if (regionCol && r[regionCol]) entry.regions.add(r[regionCol]);
    }
    return Array.from(map, ([name, data]) => ({ name, ...data })).sort(
      (a, b) => b.count - a.count,
    );
  }, [dataset, itemCol, qtyCol, regionCol]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return kw ? itemStats.filter((i) => i.name.toLowerCase().includes(kw)) : itemStats;
  }, [itemStats, keyword]);

  if (isLoading && !dataset) return null;
  if (!dataset) {
    return (
      <div className="space-y-6">
        <PageHeader title="지원품목 현황" description="지원 물품별 배부 현황을 확인합니다." />
        <EmptyState
          icon={FileUp}
          title="업로드된 데이터가 없습니다"
          message="데이터 업로드 페이지에서 엑셀 파일을 업로드하면 품목 현황을 확인할 수 있습니다."
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

  if (!itemCol) {
    return (
      <div className="space-y-6">
        <PageHeader title="지원품목 현황" />
        <EmptyState
          title="품목 열을 찾을 수 없습니다"
          message="업로드된 파일에 '지원품목' 또는 '품목' 열이 있어야 품목 현황을 표시할 수 있습니다."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="지원품목 현황"
        description={`${dataset.fileName} 기준 · ${itemStats.length}종 품목`}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-teal-500">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="품목명 검색"
            className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </label>
      </div>

      <p className="text-sm text-slate-500">총 {filtered.length}종</p>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">품목명</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">지원 건수</th>
              {qtyCol && <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">총 지원 수량</th>}
              {regionCol && <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">지원 지역 수</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filtered.map(({ name, count, totalQty, regions }) => (
              <tr key={name} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{name}</td>
                <td className="px-4 py-3 text-center text-slate-700">{formatNumber(count)}건</td>
                {qtyCol && <td className="px-4 py-3 text-center text-slate-700">{formatNumber(totalQty)}개</td>}
                {regionCol && <td className="px-4 py-3 text-center text-slate-700">{formatNumber(regions.size)}개</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
