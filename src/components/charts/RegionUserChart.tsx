import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { mockRegions } from '../../data/mockRegions';

const CHART_COLOR = '#0d9488';

const data = mockRegions.map((region) => ({ name: region.name, userCount: region.userCount }));

export default function RegionUserChart() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-900">지역별 이용자 비교</h3>
      <p className="mt-1 text-sm text-slate-500">권역별 등록 이용자 수</p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 13 }}
              formatter={(value) => [`${Number(value).toLocaleString('ko-KR')}명`, '이용자 수']}
            />
            <Bar dataKey="userCount" name="이용자 수" fill={CHART_COLOR} radius={[4, 4, 0, 0]} barSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
