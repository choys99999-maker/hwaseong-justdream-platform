import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const CHART_COLOR = '#0d9488';

interface Props {
  data: { month: string; count: number }[];
}

export default function MonthlySupportChart({ data }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-900">월별 지원 건수</h3>
      <p className="mt-1 text-sm text-slate-500">지원일 기준 월별 집계</p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 13 }}
              formatter={(value) => [`${Number(value).toLocaleString('ko-KR')}건`, '지원 건수']}
            />
            <Line
              type="monotone"
              dataKey="count"
              name="지원 건수"
              stroke={CHART_COLOR}
              strokeWidth={2}
              dot={{ r: 3, fill: CHART_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
