import { useMemo, useState } from 'react';
import { Check, FileSpreadsheet, RotateCcw } from 'lucide-react';
import QuickInventoryInput from './QuickInventoryInput';
import InventoryExcelApply from './InventoryExcelApply';
import InventoryUpdateConfirm from './InventoryUpdateConfirm';
import { useCentralData } from '../../hooks/useCentralData';
import { isCentralStoreEnabled } from '../../lib/supabase';
import { listOrganizations, type Organization } from '../../store/remote';
import {
  applyInventoryUpdate,
  buildInventoryDiff,
  citizenSyncTargets,
  previewCitizenStatus,
  syncCitizenStatus,
} from '../../store/inventoryUpdates';
import type { InventoryStatus } from '../../store/analytics';
import type { InventoryUpdateLine, InventoryUpdateOrigin } from '../../types/inventoryUpdate';

/** 자료 올리기 화면과 같은 키를 쓴다. 담당자가 매번 자기 거점을 다시 고르지 않도록. */
const ORG_KEY = 'jd-org-id';

interface InventoryUpdatePanelProps {
  /** 중앙 DB 의 현재 재고 전체. 지금 값과 견주고 품목 사전으로도 쓴다. */
  inventory: InventoryStatus[];
  /** 반영 후 상위 화면이 다시 읽게 한다. */
  onApplied: () => void;
}

interface DoneState {
  appliedCount: number;
  fileName: string;
  citizenSynced: number;
  citizenFailed: number;
}

/**
 * 재고 업데이트.
 *
 * 흩어져 있던 세 입구(자연어 빠른 입력 · 빠른 현황 입력 · Excel 업로드)를 여기 하나로 모았다.
 * 안에서 갈리는 것은 **방법**이지 진입점이 아니다.
 *   빠른 수정 — 몇 개만 말하듯 고친다 (주 동선)
 *   대량 수정 — 쓰던 Excel 을 그대로 올린다 (보조 동선)
 * 어느 쪽이든 확인 화면 → 같은 저장 경로(`applyInventoryUpdate`)를 지난다.
 */
export default function InventoryUpdatePanel({ inventory, onApplied }: InventoryUpdatePanelProps) {
  const [mode, setMode] = useState<InventoryUpdateOrigin>('quick');
  const [lines, setLines] = useState<InventoryUpdateLine[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncCitizen, setSyncCitizen] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DoneState | null>(null);

  const { data: organizations } = useCentralData(() => listOrganizations(), []);
  const [orgId, setOrgId] = useState(() => localStorage.getItem(ORG_KEY) ?? '');

  const org: Organization | null = useMemo(
    () => (organizations ?? []).find((o) => o.id === orgId) ?? null,
    [organizations, orgId],
  );

  /** 이 거점의 현재 재고. 품목 사전이자 "지금 값" 비교 기준이다. */
  const currentRows = useMemo(
    () => inventory.filter((row) => row.organizationId === orgId),
    [inventory, orgId],
  );
  const knownItems = useMemo(() => currentRows.map((row) => row.itemName), [currentRows]);

  const diffs = useMemo(() => (lines ? buildInventoryDiff(lines, currentRows) : []), [lines, currentRows]);

  const citizenTargets = useMemo(() => (org ? citizenSyncTargets(org.name) : []), [org]);
  const citizenPreview = useMemo(() => (lines ? previewCitizenStatus(lines) : null), [lines]);

  function selectOrg(id: string) {
    setOrgId(id);
    setLines(null);
    setNotice(null);
    setDone(null);
    if (id) localStorage.setItem(ORG_KEY, id);
  }

  function handleRead(next: InventoryUpdateLine[], readNotice: string | null) {
    setLines(next);
    setNotice(readNotice);
    setError(null);
    setDone(null);
  }

  function reset() {
    setLines(null);
    setNotice(null);
    setError(null);
    setDone(null);
  }

  async function handleApply() {
    if (!org || !lines) return;
    setApplying(true);
    setError(null);
    try {
      const result = await applyInventoryUpdate({
        origin: mode,
        organizationId: org.id,
        organizationName: org.name,
        regionName: org.regionName,
        lines,
      });

      let citizenSynced = 0;
      let citizenFailed = 0;
      if (syncCitizen && citizenPreview && citizenTargets.length > 0) {
        const sync = await syncCitizenStatus(citizenTargets, citizenPreview, org.name);
        citizenSynced = sync.synced;
        citizenFailed = sync.failed.length;
      }

      setDone({
        appliedCount: result.appliedCount,
        fileName: result.fileName,
        citizenSynced,
        citizenFailed,
      });
      setLines(null);
      setNotice(null);
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : '재고를 반영하지 못했습니다.');
    } finally {
      setApplying(false);
    }
  }

  if (!isCentralStoreEnabled) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
        중앙 저장소가 연결되지 않아 재고를 반영할 수 없습니다.
      </p>
    );
  }

  // ── 반영 완료 ──
  if (done) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-medium text-teal-700">
          <Check size={16} strokeWidth={2.5} />
          {org?.name} 재고 {done.appliedCount}개 품목을 반영했습니다.
        </p>
        <p className="text-sm text-slate-500">
          재고 목록과 통합 현황에 바로 반영됩니다.
          {done.citizenSynced > 0 && ` 시민 화면 거점 ${done.citizenSynced}곳의 "지금 상태"도 갱신했습니다.`}
          {done.citizenFailed > 0 && (
            <span className="text-amber-700"> 거점 {done.citizenFailed}곳은 갱신하지 못했습니다.</span>
          )}
        </p>
        <div className="rounded-lg bg-slate-50 px-3.5 py-2.5">
          <p className="text-xs font-semibold text-slate-500">최근 반영 기록</p>
          <p className="mt-1 text-sm text-slate-700">{done.fileName}</p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <RotateCcw size={14} /> 이어서 입력하기
        </button>
      </div>
    );
  }

  // ── 확인 ──
  if (lines) {
    return (
      <InventoryUpdateConfirm
        description={`${org?.name ?? ''} 재고를 아래와 같이 바꿉니다. 잘못된 줄은 그 자리에서 고치거나 뺄 수 있습니다.`}
        diffs={diffs}
        onChangeLines={setLines}
        organizationName={org?.name ?? ''}
        citizenTargets={citizenTargets}
        citizenPreview={citizenPreview}
        syncCitizen={syncCitizen}
        onSyncCitizenChange={setSyncCitizen}
        onBack={reset}
        backLabel={mode === 'quick' ? '수정하기' : '다른 파일 선택'}
        onApply={() => void handleApply()}
        applying={applying}
        error={error}
        notice={
          notice && (
            <p className="rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-500">
              {notice}
            </p>
          )
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">거점</span>
        <select
          aria-label="재고를 반영할 거점"
          value={orgId}
          onChange={(e) => selectOrg(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">선택해주세요</option>
          {(organizations ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.regionName} · {o.name}
            </option>
          ))}
        </select>
      </label>

      {mode === 'quick' ? (
        <>
          {/* ── 빠른 수정 ── */}
          <section className="space-y-2.5">
            <h3 className="text-sm font-semibold text-slate-800">빠른 수정</h3>
            <QuickInventoryInput knownItems={knownItems} disabled={!org} onRead={handleRead} />
          </section>

          {/* ── 대량 수정 ── */}
          <section className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-800">Excel로 한 번에 반영</h3>
            <p className="mt-1 text-sm text-slate-500">
              쓰던 Excel을 그대로 올려 여러 품목을 한 번에 반영합니다.
            </p>
            <button
              type="button"
              disabled={!org}
              onClick={() => {
                setMode('excel');
                reset();
              }}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50/40 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <FileSpreadsheet size={15} /> Excel 업로드
            </button>
          </section>
        </>
      ) : (
        <section className="space-y-2.5">
          <h3 className="text-sm font-semibold text-slate-800">Excel로 한 번에 반영</h3>
          <InventoryExcelApply
            disabled={!org}
            onRead={handleRead}
            onCancel={() => {
              setMode('quick');
              reset();
            }}
          />
        </section>
      )}

      {!org && (
        <p className="text-xs text-slate-400">어느 거점의 재고인지 먼저 선택해야 입력할 수 있습니다.</p>
      )}
    </div>
  );
}
