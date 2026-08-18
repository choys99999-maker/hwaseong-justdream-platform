import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { HS, VizCard } from '../admin/ui';
import { RankBars, SegmentBar, type BarSegment, type RankItem } from '../admin/charts';
import UsageTrendChart from './UsageTrendChart';
import { groupByDistrict } from '../../data/districtByArea';
import { REGION_NAMES, REGION_ORDER, SITE_STATUS_COLORS, SITE_STATUS_LABELS } from '../../data/regionMeta';
import { monthLabel, type MonthlyPoint, type RegionUsage } from '../../store/analytics';
import type { OperationSite } from '../../types';

interface OperationAnalyticsProps {
  monthly: MonthlyPoint[];
  regionUsage: RegionUsage[];
  sites: OperationSite[];
  isCentralDataLoading: boolean;
  hasCentralData: boolean;
}

/**
 * 지도 아래 Analytics Zone — 이용 추이 · 권역별 이용 · 운영 리스크.
 * 판단이 끝난 뒤에 보는 "왜/어디" 를 답하는 구역이라 지도보다 낮은 위계지만
 * "오늘 처리할 일" 업무 큐보다는 높은 위계로 지도 바로 아래 둔다(§14~18).
 *
 * 이용 추이·권역별 이용은 중앙 저장소(Supabase) 실측값(v_monthly_activity, v_region_usage)만
 * 쓰고, 자료가 없으면 그래프를 지어내지 않고 빈 상태를 그대로 보여준다.
 * 운영 리스크는 지도 위 KPI 칩과 같은 원천(mockSites)이라 숫자가 서로 어긋나지 않는다.
 */
export default function OperationAnalytics({
  monthly,
  regionUsage,
  sites,
  isCentralDataLoading,
  hasCentralData,
}: OperationAnalyticsProps) {
  const trendPoints = useMemo(
    () => monthly.map((point) => ({ month: monthLabel(point.month), count: point.count })),
    [monthly],
  );

  const regionRanking = useMemo<RankItem[]>(() => {
    const { byDistrict } = groupByDistrict(regionUsage, (row) => row.organizationName);
    return REGION_ORDER.map((id) => ({
      key: id,
      label: REGION_NAMES[id],
      value: (byDistrict.get(id) ?? []).reduce((sum, row) => sum + row.userCount, 0),
      valueText: `${(byDistrict.get(id) ?? []).reduce((sum, row) => sum + row.userCount, 0).toLocaleString('ko-KR')}명`,
    })).sort((a, b) => b.value - a.value);
  }, [regionUsage]);

  const riskSegments = useMemo<BarSegment[]>(() => {
    const countOf = (status: OperationSite['status']) => sites.filter((site) => site.status === status).length;
    return (['normal', 'shortage', 'expiring', 'missing'] as const).map((status) => ({
      key: status,
      label: SITE_STATUS_LABELS[status],
      value: countOf(status),
      color: SITE_STATUS_COLORS[status].fill,
    }));
  }, [sites]);

  return (
    <section
      aria-label="운영 분석"
      className="hci-fade-up rounded-[20px] p-5 sm:p-6"
      style={{
        background: 'linear-gradient(110deg, #EAF3FC, #F5F9FD)',
        animationDelay: '600ms',
      }}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <VizCard title="이용 추이" question="월별 이용 건수는 어떻게 움직이는가" className="lg:col-span-2" delay={0}>
          {isCentralDataLoading ? (
            <AnalyticsLoading />
          ) : !hasCentralData ? (
            <AnalyticsEmpty message="Excel 자료를 올리면 월별 이용 추이가 채워집니다." />
          ) : (
            <UsageTrendChart data={trendPoints} />
          )}
        </VizCard>

        <VizCard title="권역별 이용" question="어느 구의 이용이 가장 많은가" delay={80}>
          {isCentralDataLoading ? (
            <AnalyticsLoading />
          ) : !hasCentralData ? (
            <AnalyticsEmpty message="자료가 올라오면 구별 순위가 채워집니다." />
          ) : (
            <RankBars items={regionRanking} accent={HS.blue} emptyMessage="집계된 이용 데이터가 없습니다." />
          )}
        </VizCard>

        <VizCard title="운영 리스크" question="현재 리스크 구성은 어떤가" delay={160}>
          <SegmentBar segments={riskSegments} />
        </VizCard>
      </div>
    </section>
  );
}

function AnalyticsLoading() {
  return (
    <div className="flex h-[160px] items-center justify-center gap-2 text-[12.5px] text-[#98A2B3]">
      <Loader2 size={14} className="animate-spin" />
      불러오는 중...
    </div>
  );
}

function AnalyticsEmpty({ message }: { message: string }) {
  return <p className="flex h-[160px] items-center justify-center px-4 text-center text-[12.5px] text-[#98A2B3]">{message}</p>;
}
