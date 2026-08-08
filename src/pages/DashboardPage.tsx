import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, FileUp, MapPin, Users } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import MonthlySupportChart from '../components/charts/MonthlySupportChart';
import RegionUserChart from '../components/charts/RegionUserChart';
import { useDataStore, findCol } from '../store/dataStore';
import { formatNumber } from '../utils/format';

export default function DashboardPage() {
  const { dataset, isLoading } = useDataStore();

  const stats = useMemo(() => {
    if (!dataset) return null;
    const { records, columns } = dataset;

    const nameCol = findCol(columns, /이용자|수혜자|이름|성명/);
    const regionCol = findCol(columns, /읍면동|지역|권역/);
    const dateCol = findCol(columns, /지원일|날짜/);
    const itemCol = findCol(columns, /지원품목|품목|물품/);

    const uniqueUsers = nameCol ? new Set(records.map((r) => r[nameCol])).size : records.length;
    const uniqueRegions = regionCol ? new Set(records.map((r) => r[regionCol]).filter(Boolean)).size : 0;
    const uniqueItems = itemCol ? new Set(records.map((r) => r[itemCol]).filter(Boolean)).size : 0;

    // 이번 달 지원 건수
    const now = new Date();
    const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthCount = dateCol
      ? records.filter((r) => {
          const d = r[dateCol] ?? '';
          return d.startsWith(thisMonthPrefix) || d.replace(/\./g, '-').startsWith(thisMonthPrefix);
        }).length
      : 0;

    // 월별 지원 건수 차트 데이터
    const monthlyMap = new Map<string, number>();
    if (dateCol) {
      for (const r of records) {
        const raw = (r[dateCol] ?? '').replace(/\./g, '-');
        const m = raw.match(/^(\d{4})-(\d{1,2})/);
        if (!m) continue;
        const label = `${parseInt(m[2])}월`;
        monthlyMap.set(label, (monthlyMap.get(label) ?? 0) + 1);
      }
    }
    const monthlyData = Array.from(monthlyMap, ([month, count]) => ({ month, count })).sort(
      (a, b) => parseInt(a.month) - parseInt(b.month),
    );

    // 지역별 지원 건수 차트 데이터 (상위 10개)
    const regionMap = new Map<string, number>();
    if (regionCol) {
      for (const r of records) {
        const name = r[regionCol] ?? '';
        if (name) regionMap.set(name, (regionMap.get(name) ?? 0) + 1);
      }
    }
    const regionData = Array.from(regionMap, ([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 최근 5건
    const recentRecords = dateCol
      ? [...records].sort((a, b) => (b[dateCol] ?? '').localeCompare(a[dateCol] ?? '')).slice(0, 5)
      : records.slice(0, 5);

    return {
      totalRecords: records.length,
      uniqueUsers,
      uniqueRegions,
      uniqueItems,
      thisMonthCount,
      monthlyData,
      regionData,
      recentRecords,
      nameCol,
      regionCol,
      dateCol,
      itemCol,
    };
  }, [dataset]);

  if (isLoading) return null;
  if (!dataset || !stats) {
    return (
      <div className="space-y-6">
        <PageHeader title="통합 대시보드" description="화성시 전체 그냥드림 운영 현황을 한눈에 확인합니다." />
        <EmptyState
          icon={FileUp}
          title="업로드된 데이터가 없습니다"
          message="자료 관리에서 Excel 파일을 올리면 현황을 확인할 수 있습니다."
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="통합 대시보드"
        description={`${dataset.fileName} · ${dataset.records.length.toLocaleString()}건`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="전체 지원 건수" value={`${formatNumber(stats.totalRecords)}건`} icon={ClipboardCheck} />
        <StatCard label="이번 달 지원 건수" value={`${formatNumber(stats.thisMonthCount)}건`} icon={ClipboardCheck} />
        {stats.nameCol && (
          <StatCard label="이용자 수 (중복 제외)" value={`${formatNumber(stats.uniqueUsers)}명`} icon={Users} />
        )}
        {stats.regionCol && (
          <StatCard label="지원 지역 수" value={`${formatNumber(stats.uniqueRegions)}개`} icon={MapPin} />
        )}
      </div>

      {(stats.monthlyData.length > 0 || stats.regionData.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {stats.monthlyData.length > 0 && <MonthlySupportChart data={stats.monthlyData} />}
          {stats.regionData.length > 0 && <RegionUserChart data={stats.regionData} />}
        </div>
      )}

      {stats.recentRecords.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-900">최근 지원 내역</h3>
          <div className="mt-3 space-y-2">
            {stats.recentRecords.map((record, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-800">
                    {stats.nameCol ? record[stats.nameCol] : `행 ${i + 1}`}
                  </p>
                  {stats.regionCol && (
                    <p className="text-xs text-slate-400">{record[stats.regionCol]}</p>
                  )}
                </div>
                <div className="text-right text-xs text-slate-500">
                  {stats.itemCol && <p>{record[stats.itemCol]}</p>}
                  {stats.dateCol && <p>{record[stats.dateCol]}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
