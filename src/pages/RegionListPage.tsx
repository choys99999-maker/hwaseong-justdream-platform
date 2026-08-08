import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileUp, MapPin } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import { useDataStore, findCol, resolveSheet } from '../store/dataStore';
import { formatNumber } from '../utils/format';
import { extractEupMyeonDong } from '../utils/address';

export default function RegionListPage() {
  const { dataset, isLoading } = useDataStore();

  const view = dataset ? resolveSheet(dataset, /읍면동|지역|권역|주소/) : null;
  const regionCol = view ? findCol(view.columns, /읍면동|지역|권역/) : null;
  const addressCol = view ? findCol(view.columns, /주소|거주지/) : null;
  const nameCol = view ? findCol(view.columns, /이용자|수혜자|이름|성명/) : null;
  const itemCol = view ? findCol(view.columns, /지원품목|품목|물품/) : null;

  const hasRegionSource = !!(regionCol || addressCol);

  function getRegion(r: Record<string, string>): string {
    if (regionCol) {
      const v = r[regionCol];
      if (v) return v;
    }
    if (addressCol) {
      return extractEupMyeonDong(r[addressCol] ?? '') ?? '';
    }
    return '';
  }

  const regionSourceLabel = regionCol
    ? regionCol
    : addressCol
      ? `${addressCol} (자동 추출)`
      : '';

  const regions = useMemo(() => {
    if (!view || !hasRegionSource) return [];
    const map = new Map<string, { count: number; users: Set<string>; items: Set<string> }>();
    for (const r of view.records) {
      const name = getRegion(r);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, regionCol, addressCol, nameCol, itemCol]);

  if (isLoading) return null;
  if (!dataset) {
    return (
      <div className="space-y-6">
        <PageHeader title="지역별 현황" description="읍면동별 지원 현황을 확인합니다." />
        <EmptyState
          icon={MapPin}
          title="업로드된 데이터가 없습니다"
          message="자료 관리에서 Excel 파일을 올리면 지역별 현황을 확인할 수 있습니다."
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

  if (!hasRegionSource) {
    return (
      <div className="space-y-6">
        <PageHeader title="지역별 현황" />
        <EmptyState
          title="지역 열을 찾을 수 없습니다"
          message="업로드된 파일에 '읍면동', '지역', '권역' 또는 '주소' 열이 있어야 지역별 현황을 표시할 수 있습니다."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="지역별 현황"
        description={`${regionSourceLabel} 기준 · ${regions.length}개 지역`}
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
