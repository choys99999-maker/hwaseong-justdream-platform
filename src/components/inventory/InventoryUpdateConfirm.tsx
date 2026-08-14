import { AlertCircle, Check, Plus, TriangleAlert, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { AVAILABILITY_LABEL } from '../../utils/citizenSite';
import { formatStock } from '../../utils/format';
import type { CitizenStatusPreview, CitizenSyncTarget } from '../../store/inventoryUpdates';
import type { InventoryUpdateDiff, InventoryUpdateLine } from '../../types/inventoryUpdate';

interface InventoryUpdateConfirmProps {
  /** "다음 내용으로 반영할까요?" 위에 붙는 한 줄 설명 */
  description: string;
  diffs: InventoryUpdateDiff[];
  onChangeLines: (lines: InventoryUpdateLine[]) => void;
  organizationName: string;
  citizenTargets: CitizenSyncTarget[];
  citizenPreview: CitizenStatusPreview | null;
  syncCitizen: boolean;
  onSyncCitizenChange: (value: boolean) => void;
  onBack: () => void;
  backLabel: string;
  onApply: () => void;
  applying: boolean;
  error: string | null;
  /** 입구별로 다른 안내 (엑셀 열 인식 결과 등) */
  notice?: ReactNode;
}

/**
 * 반영 전 확인 화면.
 *
 * 자연어 입력과 Excel 업로드가 **같은 화면**으로 모인다. 담당자가 마지막으로 보는 것이
 * 입구마다 다르면 "무엇이 저장되는지"를 두 번 배워야 하기 때문이다.
 *
 * 여기서 보여주는 것: 지금 값 → 바뀔 값, 처음 보는 품목인지, 읽지 못한 값이 무엇인지.
 * 모든 줄은 그 자리에서 고칠 수 있고, 값을 읽지 못한 줄이 남아 있으면 반영을 막는다.
 */
export default function InventoryUpdateConfirm({
  description,
  diffs,
  onChangeLines,
  organizationName,
  citizenTargets,
  citizenPreview,
  syncCitizen,
  onSyncCitizenChange,
  onBack,
  backLabel,
  onApply,
  applying,
  error,
  notice,
}: InventoryUpdateConfirmProps) {
  const lines: InventoryUpdateLine[] = diffs.map(
    ({ currentStock: _c, isNewItem: _n, isUnchanged: _u, ...line }) => line,
  );

  function update(index: number, patch: Partial<InventoryUpdateLine>) {
    onChangeLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function remove(index: number) {
    onChangeLines(lines.filter((_, i) => i !== index));
  }

  function add() {
    onChangeLines([
      ...lines,
      { itemName: '', stock: null, expirationDate: null, sourceText: '직접 추가' },
    ]);
  }

  const unreadable = diffs.filter((d) => d.stock === null).length;
  const nameless = diffs.filter((d) => d.itemName.trim() === '').length;
  const applicable = diffs.filter((d) => d.itemName.trim() !== '' && d.stock !== null).length;
  const canApply = applicable > 0 && unreadable === 0 && nameless === 0 && !applying;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">다음 내용으로 반영할까요?</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      {notice}

      {/* ── 반영될 줄 ── */}
      <ul className="space-y-2">
        {diffs.map((diff, index) => {
          const needsValue = diff.stock === null;
          const missingName = diff.itemName.trim() === '';
          return (
            <li
              key={index}
              className={`rounded-xl border px-3 py-2.5 ${
                needsValue || missingName ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  aria-label={`${index + 1}번째 품목명`}
                  value={diff.itemName}
                  onChange={(e) => update(index, { itemName: e.target.value })}
                  placeholder="품목명"
                  className="min-w-32 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />

                <div className="flex items-center gap-1.5">
                  <input
                    aria-label={`${diff.itemName || `${index + 1}번째 품목`} 수량`}
                    type="number"
                    min={0}
                    value={diff.stock ?? ''}
                    onChange={(e) =>
                      update(index, {
                        stock: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                      })
                    }
                    placeholder="수량"
                    className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-right text-sm tabular-nums text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <span className="text-sm text-slate-400">개</span>
                </div>

                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`${diff.itemName || `${index + 1}번째 품목`} 빼기`}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-0.5 text-xs">
                {diff.isNewItem ? (
                  <span className="rounded bg-sky-50 px-1.5 py-0.5 font-medium text-sky-700">처음 보는 품목</span>
                ) : (
                  <span className="text-slate-500">
                    지금 {formatStock(diff.currentStock)}개 →{' '}
                    <strong className="font-semibold text-slate-800">
                      {diff.stock === null ? '?' : diff.stock}개
                    </strong>
                  </span>
                )}
                {diff.isUnchanged && <span className="text-slate-400">값이 같아 바뀌는 것이 없습니다</span>}
                {diff.expirationDate && (
                  <span className="text-slate-400">유통기한 {diff.expirationDate} 유지</span>
                )}
                <span className="text-slate-300">·</span>
                <span className="truncate text-slate-400" title={diff.sourceText}>
                  {diff.sourceText}
                </span>
              </div>

              {diff.issue && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-800">
                  <TriangleAlert size={12} className="mt-0.5 shrink-0" />
                  {diff.issue}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:border-teal-300 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        <Plus size={14} /> 품목 직접 추가
      </button>

      {/* ── 시민 화면 ── */}
      {citizenTargets.length > 0 && citizenPreview && (
        <label className="flex items-start gap-2.5 rounded-xl border border-teal-100 bg-teal-50/60 px-3.5 py-3 text-sm">
          <input
            type="checkbox"
            checked={syncCitizen}
            onChange={(e) => onSyncCitizenChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          <span className="text-slate-700">
            <span className="font-medium text-teal-800">시민 화면도 함께 갱신</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              {organizationName} 거점 {citizenTargets.length}곳 (
              {citizenTargets.map((t) => t.siteName).join(', ')})의 "지금 상태"를{' '}
              <strong className="font-semibold text-slate-700">
                {AVAILABILITY_LABEL[citizenPreview.availability]}
              </strong>
              {citizenPreview.focusItem ? ` · 주요 품목 ${citizenPreview.focusItem}` : ''} 으로 바꿉니다.
              이번에 입력한 품목만 보고 정한 값이라, 현장 담당자가 직접 남긴 상태를 덮어씁니다.
            </span>
          </span>
        </label>
      )}

      {/* ── 반영 ── */}
      {(unreadable > 0 || nameless > 0) && (
        <p className="flex items-start gap-1.5 text-sm text-amber-800">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          {nameless > 0 && `품목명이 비어 있는 줄 ${nameless}개`}
          {nameless > 0 && unreadable > 0 && ' · '}
          {unreadable > 0 && `수량을 읽지 못한 줄 ${unreadable}개`}가 있습니다. 채우거나 빼면 반영할 수
          있습니다.
        </p>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onApply}
          disabled={!canApply}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          <Check size={15} strokeWidth={2.5} />
          {applying ? '반영하는 중...' : `${applicable}개 품목 반영`}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={applying}
          className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          {backLabel}
        </button>
      </div>
    </div>
  );
}
