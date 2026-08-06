import { useState } from 'react';
import { CalendarDays, MapPin, UserCircle } from 'lucide-react';
import { mockRegions } from '../../data/mockRegions';
import { formatDateTime } from '../../utils/format';
import { useAuth } from '../../hooks/useAuth';
import { DEMO_USERS } from '../../config/demo';
import type { RegionId } from '../../types';

const MONTH_OPTIONS = ['2026-08', '2026-07', '2026-06'];

function formatMonthLabel(value: string): string {
  const [year, month] = value.split('-');
  return `${year}년 ${Number(month)}월`;
}

const latestUpdatedAt = mockRegions.reduce(
  (latest, region) => (region.lastUpdated > latest ? region.lastUpdated : latest),
  mockRegions[0].lastUpdated,
);

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[0]);
  const { user, selectedRegionId, setUser, setSelectedRegionId } = useAuth();

  const otherDemoUser = DEMO_USERS.find((u) => u.id !== user.id) ?? DEMO_USERS[0];
  const currentRegionName = mockRegions.find((r) => r.id === user.regionId)?.name ?? '';

  function handleRegionSelect(value: string) {
    setSelectedRegionId(value === 'all' ? null : (value as RegionId));
  }

  return (
    <header className="shrink-0 border-b border-slate-200 bg-white">
      {/* 상단 바 */}
      <div className="flex h-14 items-center justify-between px-6">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-300 focus-within:ring-2 focus-within:ring-teal-500">
            <CalendarDays size={15} className="text-slate-400" />
            <span className="sr-only">기준 월 선택</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="cursor-pointer bg-transparent pr-1 text-sm text-slate-700 focus:outline-none"
            >
              {MONTH_OPTIONS.map((month) => (
                <option key={month} value={month}>
                  {formatMonthLabel(month)} 기준
                </option>
              ))}
            </select>
          </label>

          <div className="hidden text-xs text-slate-400 md:block">
            최근 업데이트
            <br />
            <span className="text-slate-600">{formatDateTime(latestUpdatedAt)}</span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5">
            <UserCircle
              size={18}
              className={user.role === 'SYSTEM_ADMIN' ? 'text-teal-500' : 'text-amber-500'}
            />
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="text-xs font-semibold text-slate-800">{user.name}</span>
              <span className="text-[10px] text-slate-400">
                {user.role === 'SYSTEM_ADMIN' ? '통합관리자' : '지역관리자'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 관리 범위 바 */}
      <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-6 py-1.5">
        <MapPin size={13} className="shrink-0 text-slate-400" />

        {user.role === 'SYSTEM_ADMIN' ? (
          <>
            <span className="text-xs text-slate-500">관리 범위</span>
            <select
              value={selectedRegionId ?? 'all'}
              onChange={(e) => handleRegionSelect(e.target.value)}
              className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="all">화성시 전체</option>
              {mockRegions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <span className="text-xs text-slate-500">관리 지역</span>
            <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              {currentRegionName}
            </span>
            <span className="text-[10px] text-slate-400">다른 지역 접근 불가</span>
          </>
        )}

        {/* 데모 모드 전환 */}
        <div className="ml-auto flex items-center gap-2">
          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
            데모
          </span>
          <button
            type="button"
            onClick={() => setUser(otherDemoUser)}
            className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500"
          >
            {otherDemoUser.name}(으)로 전환
          </button>
        </div>
      </div>
    </header>
  );
}
