import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import StatusBadge from '../components/common/StatusBadge';
import { mockInventoryItems } from '../data/mockInventory';
import { formatDate, formatNumber } from '../utils/format';
import type { InventoryStatus } from '../types';

const STATUS_OPTIONS: InventoryStatus[] = ['정상', '임박', '부족', '확인 필요'];

export default function InventoryPage() {
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim();
    return mockInventoryItems.filter((item) => {
      const matchesKeyword = normalizedKeyword === '' || item.name.includes(normalizedKeyword);
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesKeyword && matchesStatus;
    });
  }, [keyword, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader title="물품·유통기한" description="지역별 물품 입출고와 유통기한 현황을 확인합니다." />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-teal-500">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="품목명 검색"
            className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </label>

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

      <p className="text-sm text-slate-500">총 {filteredItems.length}건</p>

      <DataTable
        columns={[
          { key: 'name', header: '품목명', render: (row) => row.name },
          { key: 'regionName', header: '지역', render: (row) => row.regionName },
          { key: 'inboundQuantity', header: '입고량', render: (row) => formatNumber(row.inboundQuantity) },
          { key: 'outboundQuantity', header: '배부량', render: (row) => formatNumber(row.outboundQuantity) },
          { key: 'currentStock', header: '현재 재고', render: (row) => formatNumber(row.currentStock) },
          { key: 'expiryDate', header: '유통기한', render: (row) => formatDate(row.expiryDate) },
          { key: 'status', header: '상태', render: (row) => <StatusBadge status={row.status} /> },
        ]}
        data={filteredItems}
        rowKey={(row) => row.id}
        emptyMessage="검색 조건에 맞는 물품이 없습니다."
      />
    </div>
  );
}
