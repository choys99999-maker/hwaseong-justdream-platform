import { useMemo, useState } from 'react';
import { Check, Circle, FileSpreadsheet, Loader2, RotateCcw, Sparkles } from 'lucide-react';
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
  /** 반영 완료 화면의 [완료] 버튼이 modal을 닫는다. */
  onClose: () => void;
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
export default function InventoryUpdatePanel({ inventory, onApplied, onClose }: InventoryUpdatePanelProps) {
  const [mode, setMode] = useState<InventoryUpdateOrigin>('quick');
  const [lines, setLines] = useState<InventoryUpdateLine[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
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
      <div className="ad-rise flex flex-col items-center gap-4 py-8 text-center">
        <div className="hci-scale-in flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF3FC]">
          <Check size={22} strokeWidth={2.5} className="text-[#004696]" />
        </div>
        <div>
          <p className="text-base font-semibold text-slate-900">재고 업데이트 완료</p>
          <p className="mt-1 text-sm text-slate-500">{org?.name} 재고가 업데이트되었습니다.</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
          <p className="font-medium text-slate-700">{done.appliedCount}개 품목 반영</p>
          <p className="mt-0.5 text-xs text-slate-400">방금 전</p>
          {done.citizenSynced > 0 && (
            <p className="mt-1.5 text-xs text-slate-500">
              시민 화면 거점 {done.citizenSynced}곳의 "지금 상태"도 함께 갱신했습니다.
            </p>
          )}
          {done.citizenFailed > 0 && (
            <p className="mt-1 text-xs text-amber-700">거점 {done.citizenFailed}곳은 갱신하지 못했습니다.</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-[#004696] px-8 text-sm font-bold text-white transition-colors hover:bg-[#00356F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] focus-visible:ring-offset-2"
        >
          완료
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
        >
          <RotateCcw size={12} /> 이어서 입력하기
        </button>
      </div>
    );
  }

  // ── AI 분석 중 ──
  if (analyzing) {
    return (
      <div className="ad-rise flex flex-col items-center justify-center gap-5 py-16 text-center">
        <div className="hci-scale-in flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF3FC]">
          <Sparkles size={20} className="text-[#004696]" />
        </div>
        <p className="text-[15px] font-semibold text-slate-800">AI가 재고 내용을 정리하고 있습니다</p>
        <ul className="space-y-2 text-sm">
          <li className="ad-rise flex items-center justify-center gap-2 text-slate-600" style={{ animationDelay: '0ms' }}>
            <Check size={14} className="text-[#004696]" /> 문장 이해 중
          </li>
          <li className="ad-rise flex items-center justify-center gap-2 text-slate-600" style={{ animationDelay: '80ms' }}>
            <Loader2 size={14} className="animate-spin text-[#004696]" /> 품목과 수량 확인 중
          </li>
          <li className="ad-rise flex items-center justify-center gap-2 text-slate-400" style={{ animationDelay: '160ms' }}>
            <Circle size={14} /> 업데이트 내용 정리 중
          </li>
        </ul>
      </div>
    );
  }

  // ── 확인 ──
  if (lines) {
    return (
      <InventoryUpdateConfirm
        heading={
          mode === 'quick' ? (
            <span className="flex items-center gap-1.5">
              <Sparkles size={16} className="text-[#004696]" /> AI 분석 완료
            </span>
          ) : undefined
        }
        description={
          mode === 'quick'
            ? `${diffs.length}개 품목을 정리했습니다. 반영하기 전에 내용을 확인해 주세요.`
            : `${org?.name ?? ''} 재고를 아래와 같이 바꿉니다. 잘못된 줄은 그 자리에서 고치거나 뺄 수 있습니다.`
        }
        diffs={diffs}
        onChangeLines={setLines}
        organizationName={org?.name ?? ''}
        citizenTargets={citizenTargets}
        citizenPreview={citizenPreview}
        syncCitizen={syncCitizen}
        onSyncCitizenChange={setSyncCitizen}
        onBack={reset}
        backLabel={mode === 'quick' ? '다시 입력' : '다른 파일 선택'}
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
      {mode === 'quick' && (
        <div>
          <h2 className="flex items-center gap-1.5 text-[17px] font-bold text-slate-900">
            <Sparkles size={18} className="text-[#004696]" /> AI 재고 업데이트
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            말하듯 입력하면 AI가 품목과 수량을 자동으로 정리합니다.
          </p>
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">거점</span>
        <select
          aria-label="재고를 반영할 거점"
          value={orgId}
          onChange={(e) => selectOrg(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#004696]"
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
          {/* ── AI 자연어 입력 ── */}
          <QuickInventoryInput
            knownItems={knownItems}
            disabled={!org}
            onRead={handleRead}
            onAnalyzingChange={setAnalyzing}
          />

          {/* ── 대량 수정 ── */}
          <div className="rounded-2xl bg-[#F7F9FC] px-5 py-4">
            <p className="text-sm font-semibold text-slate-700">대량 수정이 필요한가요?</p>
            <p className="mt-1 text-sm text-slate-500">
              기존 Excel 파일을 그대로 업로드해 여러 품목을 한 번에 반영할 수 있습니다.
            </p>
            <button
              type="button"
              disabled={!org}
              onClick={() => {
                setMode('excel');
                reset();
              }}
              className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-medium text-[#004696] transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
            >
              <FileSpreadsheet size={15} /> Excel 업로드
            </button>
          </div>
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
