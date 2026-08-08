import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import StatusBadge from '../components/common/StatusBadge';
import CentralDataNotice from '../components/common/CentralDataNotice';
import { useCentralData } from '../hooks/useCentralData';
import { listInventoryStatus, type InventoryStatus as InventoryRow } from '../store/analytics';
import { districtOfArea } from '../data/districtByArea';
import { REGION_NAMES } from '../data/regionMeta';
import { inventoryStatusOf } from '../utils/inventoryStatus';
import { formatDate, formatNumber } from '../utils/format';
import type { InventoryStatus } from '../types';

const STATUS_OPTIONS: InventoryStatus[] = ['정상', '임박', '부족', '확인 필요'];

/** 화면이 쓰는 한 줄. 상태·소속 구는 중앙 DB 값에서 계산한다. */
interface Row extends InventoryRow {
  status: InventoryStatus;
  districtName: string;
}

export default function InventoryPage() {
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // 입고/출고는 기간 합계, 현재재고·유통기한은 최신 제출본 기준.
  // 재제출분 제외·누계 시트 제외 규칙은 모두 v_inventory_status 안에 있다.
  const { data, error, isLoading } = useCentralData(() => listInventoryStatus(), []);

  const items = useMemo<Row[]>(() => {
    return (data ?? []).map((row) => {
      const districtId = districtOfArea(row.organizationName);
      return {
        ...row,
        status: inventoryStatusOf(row),
        districtName: districtId ? REGION_NAMES[districtId] : row.regionName,
      };
    });
  }, [data]);

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim();
    return items.filter((item) => {
      const matchesKeyword =
        normalizedKeyword === '' ||
        item.itemName.includes(normalizedKeyword) ||
        item.organizationName.includes(normalizedKeyword);
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesKeyword && matchesStatus;
    });
  }, [items, keyword, statusFilter]);

  const notice = (
    <CentralDataNotice
      isLoading={isLoading}
      error={error}
      isEmpty={items.length === 0}
      emptyMessage="아직 올라온 물품·재고 자료가 없습니다."
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="물품·재고 관리"
        description="지역별 물품 입출고, 재고, 유통기한 현황을 확인합니다. 중앙 저장소에 올라온 자료를 기준으로 집계합니다."
      />

      {notice}

      {items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <label className="flex min-w-64 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-teal-500">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="품목명 · 읍면동 검색"
                className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
            </label>

            <select
              aria-label="상태 선택"
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

          <p className="text-sm text-slate-500">
            총 {formatNumber(filteredItems.length)}건 · 현재 재고{' '}
            {formatNumber(filteredItems.reduce((sum, item) => sum + item.stock, 0))}개
          </p>

          <DataTable<Row>
            columns={[
              { key: 'itemName', header: '품목명', render: (row) => row.itemName },
              {
                key: 'organizationName',
                header: '지역',
                render: (row) => (
                  <>
                    {row.organizationName}
                    <span className="ml-2 text-xs text-slate-400">{row.districtName}</span>
                  </>
                ),
              },
              { key: 'inboundQuantity', header: '입고량', render: (row) => formatNumber(row.inboundQuantity) },
              { key: 'outboundQuantity', header: '배부량', render: (row) => formatNumber(row.outboundQuantity) },
              { key: 'stock', header: '현재 재고', render: (row) => formatNumber(row.stock) },
              {
                key: 'expirationDate',
                header: '유통기한',
                render: (row) => (row.expirationDate ? formatDate(row.expirationDate) : '—'),
              },
              { key: 'status', header: '상태', render: (row) => <StatusBadge status={row.status} /> },
            ]}
            data={filteredItems}
            rowKey={(row) => `${row.organizationId}-${row.itemName}`}
            emptyMessage="검색 조건에 맞는 물품이 없습니다."
          />
        </>
      )}
    </div>
  );
}
