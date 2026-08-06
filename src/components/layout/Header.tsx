import { useState } from 'react';
import { CalendarDays, ChevronDown, UserCircle } from 'lucide-react';
import { mockRegions } from '../../data/mockRegions';
import { formatDateTime } from '../../utils/format';

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

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-300 focus-within:ring-2 focus-within:ring-teal-500">
          <CalendarDays size={16} className="text-slate-400" />
          <span className="sr-only">기준 월 선택</span>
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
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

        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <UserCircle size={20} className="text-slate-400" />
          <span className="hidden sm:inline">관리자</span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>
      </div>
    </header>
  );
}
