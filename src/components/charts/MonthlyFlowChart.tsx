import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { monthlyInventoryFlow } from '../../data/mockInventoryFlow';

const INBOUND_COLOR = '#0d9488';
const OUTBOUND_COLOR = '#f59e0b';

export default function MonthlyFlowChart() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-900">월별 입고·출고 추이</h3>
      <p className="mt-1 text-sm text-slate-500">화성시 4개 구 합산 기준</p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={monthlyInventoryFlow} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 13 }}
              formatter={(value, name) => [`${Number(value).toLocaleString('ko-KR')}개`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#64748b' }} iconType="plainline" />
            <Line
              type="monotone"
              dataKey="inbound"
              name="입고"
              stroke={INBOUND_COLOR}
              strokeWidth={2}
              dot={{ r: 3, fill: INBOUND_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="outbound"
              name="출고"
              stroke={OUTBOUND_COLOR}
              strokeWidth={2}
              dot={{ r: 3, fill: OUTBOUND_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
