import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import StatusBadge from '../components/common/StatusBadge';
import { mockSupportRecords } from '../data/mockSupportRecords';
import { mockRegions } from '../data/mockRegions';
import { formatDate } from '../utils/format';
import type { CounselingStatus } from '../types';

const STATUS_OPTIONS: CounselingStatus[] = ['연계 완료', '연계 진행중', '미연계'];

export default function SupportRecordsPage() {
  const [keyword, setKeyword] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim();
    return mockSupportRecords.filter((record) => {
      const matchesKeyword =
        normalizedKeyword === '' ||
        record.userName.includes(normalizedKeyword) ||
        record.item.includes(normalizedKeyword);
      const matchesRegion = regionFilter === 'all' || record.regionId === regionFilter;
      const matchesStatus = statusFilter === 'all' || record.counselingStatus === statusFilter;
      return matchesKeyword && matchesRegion && matchesStatus;
    });
  }, [keyword, regionFilter, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader title="이용·지원 내역" description="이용자별 지원 물품과 상담·복지 연계 현황을 확인합니다." />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-teal-500">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="이용자명 또는 지원 물품 검색"
            className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </label>

        <select
          value={regionFilter}
          onChange={(event) => setRegionFilter(event.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">전체 지역</option>
          {mockRegions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">전체 상태</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-slate-500">총 {filteredRecords.length}건</p>

      <DataTable
        columns={[
          { key: 'userName', header: '이용자', render: (row) => row.userName },
          { key: 'regionName', header: '지역', render: (row) => row.regionName },
          { key: 'supportDate', header: '지원일', render: (row) => formatDate(row.supportDate) },
          { key: 'item', header: '지원 물품', render: (row) => row.item },
          { key: 'quantity', header: '수량', render: (row) => `${row.quantity}개` },
          { key: 'counselingStatus', header: '상담·복지 연계 상태', render: (row) => <StatusBadge status={row.counselingStatus} /> },
        ]}
        data={filteredRecords}
        rowKey={(row) => row.id}
        emptyMessage="검색 조건에 맞는 지원 내역이 없습니다."
      />
    </div>
  );
}
