/**
 * 재고 반영 저장 계층.
 *
 * 자연어 빠른 입력과 Excel 일괄 반영이 **여기 한 곳**을 지나 중앙 DB 로 간다.
 * 새 RPC·새 표를 만들지 않고 기존 경로를 그대로 탄다:
 *
 *   InventoryUpdateDraft
 *     → MappedRecord[] (엑셀 엔진이 만드는 것과 같은 camelCase 레코드)
 *     → .xlsx 원본 파일 생성 (기존 `xlsx` 의존성)
 *     → store/remote.saveSubmission()      ← 자료 올리기 화면이 쓰는 그 함수
 *     → create_submission RPC (단일 트랜잭션)
 *     → v_inventory_status → 물품 현황 화면 · 대시보드 KPI
 *
 * 원본 파일을 실제로 만들어 올리는 이유: 자료·데이터 관리 목록의 다른 제출본과 똑같이
 * "무엇을 반영했는지" 원본을 되짚을 수 있어야 하고, 그래야 `saveSubmission` 을 고치지 않고
 * 그대로 재사용할 수 있다. (기존 업로드 경로를 건드리면 회귀 위험이 생긴다)
 *
 * ⚠ 기존 제출본을 덮지 않는다(supersede 회피).
 *   create_submission 은 (a) 기간이 완전히 같거나 (b) 파일 이름이 같은 이전 제출본을
 *   superseded 로 내린다. 그래서 이 경로는
 *     - 날짜 필드(inboundDate)를 담지 않아 기간을 null 로 두고,
 *     - 파일 이름에 초 단위 시각을 넣어 겹치지 않게 한다.
 *   덕분에 재고 반영은 기존 자료를 지우지 않고 "가장 최근 보고"로 얹히기만 한다.
 */
import * as XLSX from 'xlsx';
import { saveSubmission } from './remote';
import { upsertSiteQuickStatus, type SiteAvailability } from './citizenSites';
import { supabase } from '../lib/supabase';
import { mockSites, siteAreaOf } from '../data/mockSites';
import { parseInventoryText, type ParsedInventoryLine } from '../utils/inventoryText';
import type { InventoryStatus } from './analytics';
import type { MappedRecord } from '../types/upload';
import type {
  InventoryUpdateDiff,
  InventoryUpdateDraft,
  InventoryUpdateLine,
  InventoryUpdateResult,
} from '../types/inventoryUpdate';

const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** 저장되는 시트 이름. 자료 목록에서 이 반영이 무엇이었는지 그대로 읽힌다. */
const SHEET_NAME = '재고 반영';

/** 만들어 올리는 원본 파일의 머리글. 우리 엔진이 그대로 다시 읽을 수 있는 표준 표기다. */
const FILE_HEADERS = ['지역', '기관명', '품목명', '현재재고', '유통기한'] as const;

// ── 지금 값과 견주기 ──────────────────────────────────────

function itemKey(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, '').toLowerCase();
}

/**
 * 반영할 줄들을 중앙 DB 의 현재 값과 나란히 놓는다.
 * 유통기한을 지정하지 않은 줄은 지금 DB 값을 이어받는다. (비운 채 저장하면 화면에서 사라진다)
 */
export function buildInventoryDiff(
  lines: InventoryUpdateLine[],
  current: InventoryStatus[],
): InventoryUpdateDiff[] {
  const byItem = new Map(current.map((row) => [itemKey(row.itemName), row]));

  return lines.map((line) => {
    const match = byItem.get(itemKey(line.itemName));
    const expirationDate = line.expirationDate ?? match?.expirationDate ?? null;
    return {
      ...line,
      expirationDate,
      currentStock: match?.stock ?? null,
      isNewItem: match === undefined,
      isUnchanged:
        match !== undefined && line.stock !== null && match.stock === line.stock,
    };
  });
}

// ── 자연어 해석 ───────────────────────────────────────────

export interface InventoryTextReading {
  lines: ParsedInventoryLine[];
  leftovers: string[];
  /** 무엇이 읽었는지. 화면에 그대로 밝힌다. */
  engine: 'ai' | 'rule';
  /** AI 를 쓰지 못한 사유 (있으면 화면에 안내로 띄운다) */
  fallbackReason?: string;
}

interface AiInventoryLine {
  item_name?: unknown;
  stock?: unknown;
  note?: unknown;
}

/** Edge Function 응답을 우리 모델로 좁힌다. 모양이 다르면 통째로 버리고 규칙 해석으로 간다. */
function toParsedLines(payload: unknown): ParsedInventoryLine[] | null {
  const items = (payload as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return null;

  const lines: ParsedInventoryLine[] = [];
  for (const raw of items as AiInventoryLine[]) {
    const name = typeof raw?.item_name === 'string' ? raw.item_name.trim() : '';
    if (!name) continue;
    const stock =
      typeof raw.stock === 'number' && Number.isFinite(raw.stock) && raw.stock >= 0
        ? Math.round(raw.stock)
        : null;
    lines.push({
      itemName: name,
      stock,
      sourceText: typeof raw.note === 'string' && raw.note ? raw.note : name,
      matchedKnownItem: false,
      issue: stock === null ? `${name}의 수량을 읽지 못했습니다. 직접 입력해 주세요.` : undefined,
    });
  }
  return lines;
}

/**
 * 문장을 품목별 재고로 읽는다.
 *
 * 기존 AI 구조(Supabase Edge Function + Gemini, `analyze-donation-image` 와 같은 방식)를
 * 먼저 부르고, **어떤 이유로든 실패하면 규칙 해석기로 되돌아간다.** 어느 쪽이든 결과는
 * 확인 화면에서 담당자가 직접 고칠 수 있으므로, AI 가 없어도 기능은 그대로 동작한다.
 */
export async function readInventoryText(
  text: string,
  knownItems: readonly string[],
): Promise<InventoryTextReading> {
  const local = parseInventoryText(text, knownItems);

  if (!supabase) {
    return { ...local, engine: 'rule' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('parse-inventory-text', {
      body: { text, knownItems },
    });
    if (error) throw error;

    const lines = toParsedLines(data);
    if (!lines || lines.length === 0) throw new Error('AI 응답에서 품목을 찾지 못했습니다.');
    return { lines, leftovers: [], engine: 'ai' };
  } catch (err) {
    return {
      ...local,
      engine: 'rule',
      fallbackReason:
        err instanceof Error && err.message
          ? `AI 인식을 쓰지 못해 규칙 해석으로 읽었습니다. (${err.message})`
          : 'AI 인식을 쓰지 못해 규칙 해석으로 읽었습니다.',
    };
  }
}

// ── 저장 ──────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 초 단위까지 넣어 이름이 겹치지 않게 한다. 이름이 겹치면 이전 반영이 supersede 된다. */
export function buildUpdateFileName(
  organizationName: string,
  origin: InventoryUpdateDraft['origin'],
  at: Date = new Date(),
): string {
  const stamp =
    `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}` +
    `-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  const label = origin === 'quick' ? '빠른입력' : '엑셀반영';
  return `재고반영_${label}_${organizationName}_${stamp}.xlsx`;
}

/** 반영할 줄만 남긴다. 수량을 못 읽은 줄은 저장하지 않는다. (0 은 정상적인 값이라 남긴다) */
export function applicableLines(lines: InventoryUpdateLine[]): InventoryUpdateLine[] {
  return lines.filter((line) => line.itemName.trim() !== '' && line.stock !== null);
}

/** 엑셀 엔진이 만드는 것과 같은 모양의 레코드. create_submission 이 그대로 받는다. */
function toRecords(draft: InventoryUpdateDraft): MappedRecord[] {
  return applicableLines(draft.lines).map((line) => {
    const record: MappedRecord = {
      region: draft.regionName,
      organization: draft.organizationName,
      itemName: line.itemName.trim(),
      stock: line.stock as number,
    };
    // 유통기한은 스냅샷이라 비워 두면 화면에서 사라진다. 있는 값만 넣는다.
    if (line.expirationDate) record.expirationDate = line.expirationDate;
    return record;
  });
}

/** 반영 내용을 그대로 담은 원본 .xlsx. 우리 업로드 엔진이 다시 읽을 수 있는 표준 표기다. */
function buildWorkbookFile(fileName: string, records: MappedRecord[]): File {
  const aoa: unknown[][] = [
    [...FILE_HEADERS],
    ...records.map((r) => [
      r.region ?? '',
      r.organization ?? '',
      r.itemName ?? '',
      r.stock ?? '',
      r.expirationDate ?? '',
    ]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), SHEET_NAME);
  // SheetJS 는 버전에 따라 ArrayBuffer 또는 Uint8Array 를 돌려준다. (엔진 테스트와 같은 처리)
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer | Uint8Array;
  const buffer: ArrayBuffer =
    out instanceof Uint8Array
      ? (out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer)
      : out;
  return new File([buffer], fileName, { type: EXCEL_MIME });
}

/**
 * 재고 반영. 자연어·Excel 두 입구가 모두 이 함수를 부른다.
 * 저장에 성공하면 물품 현황 화면과 대시보드 KPI 가 다음 조회부터 새 값을 읽는다.
 */
export async function applyInventoryUpdate(
  draft: InventoryUpdateDraft,
): Promise<InventoryUpdateResult> {
  if (!draft.organizationId) throw new Error('반영할 읍면동을 먼저 선택해 주세요.');

  const records = toRecords(draft);
  if (records.length === 0) {
    throw new Error('반영할 품목이 없습니다. 품목명과 수량을 확인해 주세요.');
  }

  const fileName = buildUpdateFileName(draft.organizationName, draft.origin);
  const file = buildWorkbookFile(fileName, records);

  const submissionId = await saveSubmission({
    file,
    fileName,
    organizationId: draft.organizationId,
    issueCount: 0,
    sheets: [
      {
        sheetName: SHEET_NAME,
        sheetType: 'generic',
        errorCount: 0,
        isCumulative: false,
        records,
      },
    ],
  });

  return { submissionId, appliedCount: records.length, fileName };
}

// ── 시민 화면 반영 ────────────────────────────────────────
// 시민 화면(`/`, `/site/:id`)이 보는 값은 품목별 재고가 아니라 거점별 "지금 상태"
// (`site_quick_status`)다. 재고를 고쳤는데 시민 화면이 그대로면 두 화면이 어긋나므로,
// 반영과 함께 그 읍면동 거점의 상태도 갱신할 수 있게 한다.
// 새 판정 규칙을 만들지 않고 기존 3단계(available/low/unknown)에 그대로 담는다.

export interface CitizenSyncTarget {
  siteId: string;
  siteName: string;
}

/** 이 읍면동에 있는 거점들. (좌표로 검증된 mockSites 의 area 값을 그대로 쓴다) */
export function citizenSyncTargets(organizationName: string): CitizenSyncTarget[] {
  return mockSites
    .filter((site) => siteAreaOf(site.id) === organizationName)
    .map((site) => ({ siteId: site.id, siteName: site.displayName }));
}

export interface CitizenStatusPreview {
  availability: SiteAvailability;
  /** 시민 화면에 "지금 확인된 물품"으로 보이는 이름 */
  focusItem: string | null;
}

/**
 * 이번에 반영한 품목만 보고 시민 화면 상태를 정한다.
 * 남은 게 하나라도 있으면 '지금 받을 수 있어요', 반영한 품목이 전부 0 이면 '얼마 안 남았어요'.
 * (기존 재고 상태 → 시민 3단계 접기 규칙과 같은 방향이다: 부족 → low)
 */
export function previewCitizenStatus(lines: InventoryUpdateLine[]): CitizenStatusPreview | null {
  const usable = applicableLines(lines);
  if (usable.length === 0) return null;

  const top = usable.reduce((best, line) =>
    (line.stock as number) > (best.stock as number) ? line : best,
  );
  if ((top.stock as number) <= 0) return { availability: 'low', focusItem: null };
  return { availability: 'available', focusItem: top.itemName.trim() };
}

/** 반영 결과를 거점 "지금 상태"에 옮긴다. 실패한 거점은 그대로 돌려준다. */
export async function syncCitizenStatus(
  targets: CitizenSyncTarget[],
  preview: CitizenStatusPreview,
  organizationName: string,
): Promise<{ synced: number; failed: CitizenSyncTarget[] }> {
  let synced = 0;
  const failed: CitizenSyncTarget[] = [];

  for (const target of targets) {
    try {
      await upsertSiteQuickStatus({
        siteId: target.siteId,
        availability: preview.availability,
        focusItem: preview.focusItem ?? undefined,
        note: `${organizationName} 재고 반영에서 갱신`,
      });
      synced++;
    } catch {
      failed.push(target);
    }
  }
  return { synced, failed };
}
