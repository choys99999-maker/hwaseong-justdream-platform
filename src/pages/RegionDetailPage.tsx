import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, FileUp, MapPin, Users } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import MonthlySupportChart from '../components/charts/MonthlySupportChart';
import { useDataStore, getField } from '../store/dataStore';
import { formatNumber } from '../utils/format';

const PAGE_SIZE = 20;

export default function RegionDetailPage() {
  const { regionId } = useParams<{ regionId: string }>();
  const { dataset, isLoading } = useDataStore();
  const regionName = regionId ? decodeURIComponent(regionId) : '';

  const regionCol = getField(dataset, 'region');
  const nameCol = getField(dataset, 'name');
  const dateCol = getField(dataset, 'date');
  const qtyCol = getField(dataset, 'quantity');

  const { regionRecords, monthlyData } = useMemo(() => {
    if (!dataset) return { regionRecords: [], monthlyData: [] };

    const records = regionCol
      ? dataset.records.filter((r) => r[regionCol] === regionName)
      : dataset.records;

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
  }, [dataset, regionCol, dateCol, regionName]);

  if (isLoading && !dataset) return null;
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
          message="데이터 업로드 페이지에서 엑셀 파일을 업로드해 주세요."
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

      {/* 지원 내역 테이블 */}
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
                {dataset.columns.filter((c) => c !== regionCol).map((col) => (
                  <th key={col} className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-slate-500">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {regionRecords.slice(0, PAGE_SIZE).map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  {dataset.columns.filter((c) => c !== regionCol).map((col) => (
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
            {regionRecords.length.toLocaleString()}건 중 {PAGE_SIZE}건 표시 — 전체 내역은 이용·지원 내역 페이지에서 확인하세요.
          </p>
        )}
      </section>
    </div>
  );
}
