import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface UsageTrendPoint {
  month: string;
  count: number;
}

const BLUE = '#004696';

/**
 * 이용 추이 — Analytics Zone에서 가장 큰 영역.
 * 축·grid를 최소화하고 가장 최근 point만 크게 찍어 눈에 띄게 한다.
 */
export default function UsageTrendChart({ data }: { data: UsageTrendPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="flex h-[220px] items-center justify-center px-4 text-center text-[12.5px] text-[#98A2B3]">
        아직 집계된 월별 이용 데이터가 없습니다.
      </p>
    );
  }

  const lastIndex = data.length - 1;

  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
          <XAxis dataKey="month" tick={{ fill: '#8A96A8', fontSize: 11.5 }} axisLine={false} tickLine={false} />
          <YAxis hide domain={[0, (max: number) => Math.ceil(max * 1.15)]} />
          <Tooltip
            contentStyle={{ borderRadius: 10, borderColor: '#DFE7EF', fontSize: 12.5 }}
            labelStyle={{ color: '#182230', fontWeight: 600 }}
            formatter={(value) => [`${Number(value).toLocaleString('ko-KR')}건`, '이용']}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={BLUE}
            strokeWidth={2.5}
            fill={BLUE}
            fillOpacity={0.1}
            animationDuration={400}
            animationEasing="ease-out"
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const { cx = 0, cy = 0, index = -1 } = props;
              const isLast = index === lastIndex;
              return (
                <circle
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={isLast ? 5 : 3}
                  fill={BLUE}
                  stroke={isLast ? '#ffffff' : 'none'}
                  strokeWidth={isLast ? 2 : 0}
                />
              );
            }}
            activeDot={{ r: 5.5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
