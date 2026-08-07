import { Link } from 'react-router-dom';
import { FileSpreadsheet, FolderClosed, Plus, Trash2 } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import { useDataStore } from '../store/dataStore';

export default function FileManagePage() {
  const { datasets, activeId, isLoading, removeDataset, clearAll } = useDataStore();

  if (isLoading) return null;

  if (datasets.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="파일 관리"
          description="저장된 파일을 관리하거나 새 파일을 추가할 수 있습니다."
          actions={
            <Link
              to="/upload"
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-teal-700"
            >
              <Plus size={15} /> 파일 추가
            </Link>
          }
        />
        <EmptyState
          icon={FolderClosed}
          title="저장된 파일이 없습니다"
          message="파일 추가 버튼을 눌러 엑셀 파일을 업로드해 주세요."
        />
      </div>
    );
  }

  function handleDelete(id: string, name: string) {
    if (window.confirm(`"${name}" 파일을 삭제하시겠습니까?`)) {
      removeDataset(id);
    }
  }

  function handleClearAll() {
    if (window.confirm(`저장된 파일 ${datasets.length}개를 모두 삭제하시겠습니까?`)) {
      clearAll();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="파일 관리"
        description="저장된 파일을 관리하거나 새 파일을 추가할 수 있습니다."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
            >
              <Trash2 size={15} /> 전체 삭제
            </button>
            <Link
              to="/upload"
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-teal-700"
            >
              <Plus size={15} /> 파일 추가
            </Link>
          </div>
        }
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="mb-3 text-sm text-slate-500">
          총 <strong className="text-slate-800">{datasets.length}개</strong> 파일이 저장되어 있습니다.
        </p>
        <div className="space-y-2">
          {[...datasets].reverse().map((d) => {
            const isActive = d.id === activeId;
            const uploadedDate = new Date(d.uploadedAt).toLocaleString('ko-KR', {
              year: 'numeric',
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <div
                key={d.id}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                  isActive ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <FileSpreadsheet size={20} className={isActive ? 'shrink-0 text-teal-500' : 'shrink-0 text-slate-400'} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-800">{d.fileName}</p>
                    {isActive && (
                      <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                        활성
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {d.records.length.toLocaleString()}건 · {uploadedDate}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(d.id, d.fileName)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={13} /> 삭제
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
