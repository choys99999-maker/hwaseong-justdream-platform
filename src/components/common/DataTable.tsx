import type { ReactNode } from 'react';
import EmptyState from './EmptyState';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
}

export default function DataTable<T>({ columns, data, rowKey, emptyMessage }: DataTableProps<T>) {
  if (data.length === 0) {
    return <EmptyState message={emptyMessage ?? '표시할 데이터가 없습니다.'} />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className="whitespace-nowrap px-4 py-3 text-left font-medium text-slate-500">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {data.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-slate-50">
              {columns.map((column) => (
                <td key={column.key} className={`whitespace-nowrap px-4 py-3 text-slate-700 ${column.className ?? ''}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
