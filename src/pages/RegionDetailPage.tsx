import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, FileUp, MapPin, Users } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import MonthlySupportChart from '../components/charts/MonthlySupportChart';
import { useDataStore, findCol, resolveSheet } from '../store/dataStore';
import { formatNumber } from '../utils/format';
import { extractEupMyeonDong } from '../utils/address';

const PAGE_SIZE = 20;

export default function RegionDetailPage() {
  const { regionId } = useParams<{ regionId: string }>();
  const { dataset, isLoading } = useDataStore();
  const regionName = regionId ? decodeURIComponent(regionId) : '';

  const view = dataset ? resolveSheet(dataset, /읍면동|지역|권역|주소/) : null;
  const regionCol = view ? findCol(view.columns, /읍면동|지역|권역/) : null;
  const addressCol = view ? findCol(view.columns, /주소|거주지/) : null;
  const nameCol = view ? findCol(view.columns, /이용자|수혜자|이름|성명/) : null;
  const dateCol = view ? findCol(view.columns, /지원일|날짜|일자/) : null;
  const qtyCol = view ? findCol(view.columns, /수량/) : null;

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

  const displayCols = (view?.columns ?? []).filter(
    (c) => c !== regionCol && c !== addressCol,
  );

  const { regionRecords, monthlyData } = useMemo(() => {
    if (!view) return { regionRecords: [], monthlyData: [] };

    const records = view.records.filter((r) => getRegion(r) === regionName);

    const sorted = dateCol
      ? [...records].sort((a, b) => (b[dateCol] ?? '').localeCompare(a[dateCol] ?? ''))
      : records;

    const mMap = new Map<string, number>();
    if (dateCol) {
      for (const r of records) {
        const raw = (r[dateCol] ?? '').replace(/\./g, '-');
        const m = raw.match(/^(\d{4})-(\d{1,2})/);
        if (!m) continue;
        const label = `${parseInt(m[2])}월`;
        mMap.set(label, (mMap.get(label) ?? 0) + 1);
      }
    }
    const monthly = Array.from(mMap, ([month, count]) => ({ month, count })).sort(
      (a, b) => parseInt(a.month) - parseInt(b.month),
    );

    return { regionRecords: sorted, monthlyData: monthly };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, regionCol, addressCol, dateCol, regionName]);

  if (isLoading) return null;
  if (!dataset) {
    return (
      <div className="space-y-6">
        <Link to="/regions" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-teal-600">
          <ArrowLeft size={16} /> 지역별 현황으로 돌아가기
        </Link>
        <PageHeader title="지역 상세" />
        <EmptyState
          icon={FileUp}
          title="업로드된 데이터가 없습니다"
          message="자료 관리에서 Excel 파일을 올려주세요."
        />
      </div>
    );
  }

  if (regionRecords.length === 0) {
    return (
      <div className="space-y-6">
        <Link to="/regions" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-teal-600">
          <ArrowLeft size={16} /> 지역별 현황으로 돌아가기
        </Link>
        <PageHeader title={regionName || '지역 상세'} />
        <EmptyState title="해당 지역의 데이터가 없습니다" message="지역명을 다시 확인해 주세요." />
      </div>
    );
  }

  const uniqueUsers = nameCol ? new Set(regionRecords.map((r) => r[nameCol])).size : null;

  return (
    <div className="space-y-6">
      <Link to="/regions" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-teal-600">
        <ArrowLeft size={16} /> 지역별 현황으로 돌아가기
      </Link>

      <PageHeader
        title={regionName}
        description={`${dataset.fileName} 기준 · 총 ${regionRecords.length.toLocaleString()}건`}
        actions={
          <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
            <MapPin size={12} /> {regionName}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="지원 건수" value={`${formatNumber(regionRecords.length)}건`} icon={ClipboardList} />
        {uniqueUsers !== null && (
          <StatCard label="이용자 수" value={`${formatNumber(uniqueUsers)}명`} icon={Users} />
        )}
      </div>

      {monthlyData.length > 1 && (
        <MonthlySupportChart data={monthlyData} />
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-base font-semibold text-slate-900">
          지원 내역
          <span className="ml-2 text-sm font-normal text-slate-400">
            (최대 {PAGE_SIZE}건 표시)
          </span>
        </h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {displayCols.map((col) => (
                  <th key={col} className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-slate-500">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {regionRecords.slice(0, PAGE_SIZE).map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  {displayCols.map((col) => (
                    <td key={col} className="whitespace-nowrap px-4 py-2.5 text-slate-700">
                      {col === qtyCol ? `${row[col]}개` : row[col] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {regionRecords.length > PAGE_SIZE && (
          <p className="mt-2 text-right text-xs text-slate-400">
            {regionRecords.length.toLocaleString()}건 중 {PAGE_SIZE}건 표시
          </p>
        )}
      </section>
    </div>
  );
}
