import { useMemo, useState } from 'react';
import { Check, PackageCheck, PackageX, HelpCircle } from 'lucide-react';
import CentralDataNotice from '../common/CentralDataNotice';
import { useCentralData } from '../../hooks/useCentralData';
import { listSiteQuickStatus, upsertSiteQuickStatus, type SiteAvailability } from '../../store/citizenSites';
import { mockSites } from '../../data/mockSites';
import { REGION_NAMES } from '../../data/regionMeta';

export const AVAILABILITY_OPTIONS: {
  value: SiteAvailability;
  label: string;
  icon: typeof PackageCheck;
  className: string;
}[] = [
  { value: 'available', label: '지금 가능', icon: PackageCheck, className: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  { value: 'low', label: '얼마 안 남음', icon: PackageX, className: 'border-amber-300 bg-amber-50 text-amber-800' },
  { value: 'unknown', label: '확인 필요', icon: HelpCircle, className: 'border-slate-300 bg-slate-50 text-slate-700' },
];

export function availabilityLabel(value: SiteAvailability): string {
  return AVAILABILITY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

interface QuickStatusFormProps {
  /** 거점을 고정한다(거점 상세 안에서 쓸 때). 없으면 목록에서 고른다. */
  fixedSiteId?: string;
  /** 저장 성공 후 상위 화면이 다시 읽게 한다. */
  onSaved?: () => void;
}

/**
 * 빠른 현황 입력.
 *
 * 시민 화면(`/`, `/site/:id`)의 "지금 상태"가 바로 이 폼이 저장하는 값이다.
 * 거점 → 상태 → 저장, 그 이상 묻지 않는다. 거점 상세 안(거점 고정)과
 * 단독 화면(거점 선택) 두 곳에서 같은 폼을 그대로 쓴다.
 */
export default function QuickStatusForm({ fixedSiteId, onSaved }: QuickStatusFormProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, isLoading, error } = useCentralData(() => listSiteQuickStatus(), [refreshKey]);

  const [selectedSiteId, setSelectedSiteId] = useState(mockSites[0]?.id ?? '');
  const siteId = fixedSiteId ?? selectedSiteId;

  const [availability, setAvailability] = useState<SiteAvailability | null>(null);
  const [focusItem, setFocusItem] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const currentStatus = data?.get(siteId) ?? null;
  const site = mockSites.find((s) => s.id === siteId) ?? null;

  const sortedSites = useMemo(
    () => [...mockSites].sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko')),
    [],
  );

  function handleSelectSite(id: string) {
    setSelectedSiteId(id);
    setAvailability(null);
    setFocusItem('');
    setNote('');
    setSavedAt(null);
  }

  async function handleSave() {
    if (!availability) return;
    setSaving(true);
    setSaveError(null);
    try {
      await upsertSiteQuickStatus({
        siteId,
        availability,
        focusItem: focusItem.trim() || undefined,
        note: note.trim() || undefined,
      });
      setSavedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }));
      setRefreshKey((k) => k + 1);
      onSaved?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  // 단계 번호는 거점을 고르는 화면에서만 의미가 있다.
  const stepPrefix = fixedSiteId ? '' : '2. ';

  return (
    <div className="space-y-4">
      <CentralDataNotice isLoading={isLoading} error={error} />

      {!fixedSiteId && (
        <div>
          <label htmlFor="qs-site" className="mb-1.5 block text-sm font-semibold text-slate-700">
            1. 거점
          </label>
          <select
            id="qs-site"
            value={siteId}
            onChange={(e) => handleSelectSite(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {sortedSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName} · {REGION_NAMES[s.district]}
              </option>
            ))}
          </select>
        </div>
      )}

      {currentStatus && (
        <p className="text-xs text-slate-400">
          마지막 저장:{' '}
          {new Date(currentStatus.updatedAt).toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })}{' '}
          · {availabilityLabel(currentStatus.availability)}
          {currentStatus.focusItem ? ` · ${currentStatus.focusItem}` : ''}
        </p>
      )}

      <div>
        <p className="mb-1.5 text-sm font-semibold text-slate-700">{stepPrefix}지금 상태</p>
        <div className="grid grid-cols-3 gap-2">
          {AVAILABILITY_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = availability === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAvailability(opt.value)}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-3 text-sm font-medium transition-colors ${
                  active ? opt.className : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                <Icon size={18} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="qs-item" className="mb-1.5 block text-sm font-semibold text-slate-700">
          주요 품목 <span className="font-normal text-slate-400">(선택)</span>
        </label>
        <input
          id="qs-item"
          value={focusItem}
          onChange={(e) => setFocusItem(e.target.value)}
          placeholder={site?.focusItem ?? '예: 즉석밥 세트'}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <div>
        <label htmlFor="qs-note" className="mb-1.5 block text-sm font-semibold text-slate-700">
          메모 <span className="font-normal text-slate-400">(선택, 내부용)</span>
        </label>
        <input
          id="qs-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {saveError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{saveError}</p>}
      {savedAt && !saveError && (
        <p className="flex items-center gap-1.5 rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-700">
          <Check size={13} /> {savedAt} 저장 완료 · 시민 화면에 바로 반영됩니다
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={!availability || saving}
        className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        {saving ? '저장하는 중...' : fixedSiteId ? '저장' : '3. 저장'}
      </button>
    </div>
  );
}
