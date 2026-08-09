import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthlyTrendPoint } from '../../types';

const CHART_COLOR = '#0d9488';

interface RegionTrendChartProps {
  data: MonthlyTrendPoint[];
}

export default function RegionTrendChart({ data }: RegionTrendChartProps) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 13 }}
            formatter={(value) => [`${Number(value).toLocaleString('ko-KR')}건`, '지원 건수']}
          />
          <Area type="monotone" dataKey="count" name="지원 건수" stroke={CHART_COLOR} strokeWidth={2} fill={CHART_COLOR} fillOpacity={0.12} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
