import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const CHART_COLOR = '#0d9488';

interface Props {
  data: { name: string; count: number }[];
}

export default function RegionUserChart({ data }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-900">지역별 지원 건수</h3>
      <p className="mt-1 text-sm text-slate-500">읍면동 기준 지원 건수 비교</p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 13 }}
              formatter={(value) => [`${Number(value).toLocaleString('ko-KR')}건`, '지원 건수']}
            />
            <Bar dataKey="count" name="지원 건수" fill={CHART_COLOR} radius={[4, 4, 0, 0]} barSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
