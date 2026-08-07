import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileUp, MapPin } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import { useDataStore, getField } from '../store/dataStore';
import { formatNumber } from '../utils/format';

export default function RegionListPage() {
  const { dataset, isLoading } = useDataStore();

  const regionCol = getField(dataset, 'region');
  const nameCol = getField(dataset, 'name');
  const itemCol = getField(dataset, 'item');

  const regions = useMemo(() => {
    if (!dataset || !regionCol) return [];
    const map = new Map<string, { count: number; users: Set<string>; items: Set<string> }>();
    for (const r of dataset.records) {
      const name = r[regionCol] ?? '';
      if (!name) continue;
      if (!map.has(name)) map.set(name, { count: 0, users: new Set(), items: new Set() });
      const entry = map.get(name)!;
      entry.count++;
      if (nameCol && r[nameCol]) entry.users.add(r[nameCol]);
      if (itemCol && r[itemCol]) entry.items.add(r[itemCol]);
    }
    return Array.from(map, ([name, data]) => ({ name, ...data })).sort(
      (a, b) => b.count - a.count,
    );
  }, [dataset, regionCol, nameCol, itemCol]);

  if (isLoading && !dataset) return null;
  if (!dataset) {
    return (
      <div className="space-y-6">
        <PageHeader title="지역별 현황" description="읍면동별 지원 현황을 확인합니다." />
        <EmptyState
          icon={MapPin}
          title="업로드된 데이터가 없습니다"
          message="데이터 업로드 페이지에서 엑셀 파일을 업로드하면 지역별 현황을 확인할 수 있습니다."
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

  if (!regionCol) {
    return (
      <div className="space-y-6">
        <PageHeader title="지역별 현황" />
        <EmptyState
          title="지역 열을 찾을 수 없습니다"
          message="업로드된 파일에 '읍면동' 또는 '지역' 열이 있어야 지역별 현황을 표시할 수 있습니다."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="지역별 현황"
        description={`${regionCol} 기준 · ${regions.length}개 지역`}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {regions.map(({ name, count, users, items }) => (
          <Link
            key={name}
            to={`/regions/${encodeURIComponent(name)}`}
            className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-teal-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <div className="flex items-center gap-2">
              <MapPin size={16} className="shrink-0 text-teal-500" />
              <h3 className="text-base font-semibold text-slate-900">{name}</h3>
            </div>

            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-slate-400">지원 건수</dt>
              <dd className="text-right font-medium text-slate-700">{formatNumber(count)}건</dd>
              {nameCol && (
                <>
                  <dt className="text-slate-400">이용자 수</dt>
                  <dd className="text-right font-medium text-slate-700">{formatNumber(users.size)}명</dd>
                </>
              )}
              {itemCol && (
                <>
                  <dt className="text-slate-400">지원 품목 수</dt>
                  <dd className="text-right font-medium text-slate-700">{formatNumber(items.size)}종</dd>
                </>
              )}
            </dl>

            <div className="flex items-center justify-end border-t border-slate-100 pt-3">
              <span className="flex items-center gap-1 text-xs font-medium text-teal-600 group-hover:text-teal-700">
                상세보기 <ArrowRight size={14} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
