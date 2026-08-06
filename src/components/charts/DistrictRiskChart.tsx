import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { districtSummaries } from '../../data/operationSummary';
import { SITE_STATUS_COLORS } from '../../data/regionMeta';

const data = districtSummaries.map((summary) => ({
  name: summary.name,
  shortage: summary.shortageQuantity,
  expiring: summary.expiringQuantity,
}));

export default function DistrictRiskChart() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-900">구별 재고 위험 현황</h3>
      <p className="mt-1 text-sm text-slate-500">7일 내 예상 부족 수량과 유통기한 임박 수량</p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 13 }}
              formatter={(value, name) => [`${Number(value).toLocaleString('ko-KR')}개`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#64748b' }} iconType="square" />
            <Bar dataKey="shortage" name="부족 예상" fill={SITE_STATUS_COLORS.shortage.fill} radius={[4, 4, 0, 0]} barSize={22} />
            <Bar dataKey="expiring" name="유통기한 임박" fill={SITE_STATUS_COLORS.expiring.fill} radius={[4, 4, 0, 0]} barSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
