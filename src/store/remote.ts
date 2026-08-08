// Supabase 중앙 저장소 접근 계층 (Phase 1).
// worker가 만든 camelCase 정규화 레코드를 그대로 RPC(jsonb)로 넘기고,
// 조회 시에는 화면(기존 미리보기 표)이 쓰는 label-keyed 형태로 되돌려준다.
import { supabase } from '../lib/supabase';
import { getColumnsForType } from '../utils/excel/schema';
import { sheetTypeLabel, type TypeSummary } from '../utils/submission';
import type { MappedRecord, PlatformColumnKey, SheetType } from '../types/upload';

/** 자료 상세 미리보기 표가 쓰는 시트 한 장. 값은 label을 키로 갖는 문자열이다. */
export interface SheetEntry {
  sheetName: string;
  sheetType: string;
  columns: string[];
  records: Record<string, string>[];
}

const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function client() {
  if (!supabase) throw new Error('중앙 저장소가 설정되지 않았습니다.');
  return supabase;
}

// ── 조직 ─────────────────────────────────────────────────
export interface Organization {
  id: string;
  name: string;
  regionId: string;
  regionName: string;
}

export async function listOrganizations(): Promise<Organization[]> {
  const { data, error } = await client()
    .from('organizations')
    .select('id, name, region_id, region_name')
    .order('name');
  if (error) throw new Error(`기관 목록을 불러오지 못했습니다: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    regionId: row.region_id,
    regionName: row.region_name,
  }));
}

// ── 저장 ─────────────────────────────────────────────────
export interface SheetPayload {
  sheetName: string;
  sheetType: SheetType;
  errorCount: number;
  /** 누계 시트는 집계에서 제외된다. (주별 실적과 이중 계산 방지) */
  isCumulative: boolean;
  records: MappedRecord[];
}

/** 기간 산출에 쓰는 날짜 필드. 생년월일·유통기한은 자료 기간이 아니다. */
const PERIOD_KEYS: PlatformColumnKey[] = ['consultDate', 'inboundDate'];

function derivePeriodFromRecords(sheets: SheetPayload[]): { start: string | null; end: string | null } {
  let min: string | null = null;
  let max: string | null = null;
  for (const sheet of sheets) {
    for (const record of sheet.records) {
      for (const key of PERIOD_KEYS) {
        const val = record[key];
        if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val)) continue;
        if (!min || val < min) min = val;
        if (!max || val > max) max = val;
      }
    }
  }
  return { start: min, end: max };
}

/**
 * 원본 Excel을 Storage에 올린 뒤 create_submission RPC 한 번으로
 * submission + files + sheets + 업무 레코드를 단일 트랜잭션 저장한다.
 * RPC가 실패하면 DB에는 아무것도 남지 않는다. (Storage 파일만 고아로 남을 수 있음)
 */
export async function saveSubmission(input: {
  file: File;
  fileName: string;
  organizationId: string;
  issueCount: number;
  sheets: SheetPayload[];
}): Promise<string> {
  const sb = client();

  // 한글 파일명은 Storage 키로 쓰지 않는다. 원본 이름은 submissions.file_name에 남는다.
  const storagePath = `${input.organizationId}/${crypto.randomUUID()}.xlsx`;
  const contentType = input.file.type || EXCEL_MIME;

  // File 대신 ArrayBuffer로 올리면 multipart 없이 원시 바디로 전송된다.
  const bytes = await input.file.arrayBuffer();
  const { error: uploadError } = await sb.storage
    .from('submissions')
    .upload(storagePath, bytes, { contentType });
  if (uploadError) {
    throw new Error(`원본 파일 업로드에 실패했습니다: ${uploadError.message}`);
  }

  const period = derivePeriodFromRecords(input.sheets);
  const { data, error } = await sb.rpc('create_submission', {
    p_organization_id: input.organizationId,
    p_file_name: input.fileName,
    p_storage_path: storagePath,
    p_file_size: input.file.size,
    p_content_type: contentType,
    p_issue_count: input.issueCount,
    p_period_start: period.start,
    p_period_end: period.end,
    p_sheets: input.sheets.map((s) => ({
      sheetName: s.sheetName,
      sheetType: s.sheetType,
      errorCount: s.errorCount,
      isCumulative: s.isCumulative,
      records: s.records,
    })),
  });
  if (error) throw new Error(`자료 저장에 실패했습니다: ${error.message}`);
  return data as string;
}

// ── 목록 ─────────────────────────────────────────────────
export interface RemoteSubmissionSummary {
  id: string;
  fileName: string;
  organizationName: string;
  regionName: string;
  issueCount: number;
  recordCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  uploadedAt: string;
  /** superseded = 같은 기관이 같은 기간 자료를 다시 올려 대체된 제출본. 집계에서 빠진다. */
  isSuperseded: boolean;
  types: TypeSummary[];
}

interface SubmissionRow {
  id: string;
  file_name: string;
  issue_count: number;
  record_count: number;
  period_start: string | null;
  period_end: string | null;
  uploaded_at: string;
  status: string;
  organizations: { name: string; region_name: string } | null;
  submission_sheets: { sheet_type: string; record_count: number }[];
}

function summarizeSheetTypes(sheets: { sheet_type: string; record_count: number }[]): TypeSummary[] {
  const map = new Map<string, number>();
  for (const s of sheets) {
    if (s.record_count === 0) continue;
    map.set(s.sheet_type, (map.get(s.sheet_type) ?? 0) + s.record_count);
  }
  return Array.from(map, ([type, count]) => ({ type, label: sheetTypeLabel(type), count })).sort(
    (a, b) => b.count - a.count,
  );
}

function toSummary(row: SubmissionRow): RemoteSubmissionSummary {
  return {
    id: row.id,
    fileName: row.file_name,
    organizationName: row.organizations?.name ?? '기관 미상',
    regionName: row.organizations?.region_name ?? '',
    issueCount: row.issue_count,
    recordCount: row.record_count,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    uploadedAt: row.uploaded_at,
    isSuperseded: row.status === 'superseded',
    types: summarizeSheetTypes(row.submission_sheets ?? []),
  };
}

const SUMMARY_SELECT =
  'id, file_name, issue_count, record_count, period_start, period_end, uploaded_at, status, ' +
  'organizations(name, region_name), submission_sheets(sheet_type, record_count)';

/** 자료 관리 목록. 대체된(superseded) 제출본은 빼고 현재 유효한 자료만 보여준다. */
export async function listSubmissions(): Promise<RemoteSubmissionSummary[]> {
  const { data, error } = await client()
    .from('submissions')
    .select(SUMMARY_SELECT)
    .eq('status', 'active')
    .order('uploaded_at', { ascending: false });
  if (error) throw new Error(`자료 목록을 불러오지 못했습니다: ${error.message}`);
  return ((data ?? []) as unknown as SubmissionRow[]).map(toSummary);
}

// ── 상세 ─────────────────────────────────────────────────
export interface RemoteSubmissionDetail {
  summary: RemoteSubmissionSummary;
  sheets: SheetEntry[];
}

/** DB(snake_case) 컬럼 → worker의 camelCase 키. 유형별로 되돌릴 때 쓴다. */
const DB_COLUMN_BY_KEY: Record<SheetType, Partial<Record<PlatformColumnKey, string>>> = {
  performance: {
    institution: 'institution',
    userCount: 'user_count',
    basicConsultation: 'basic_consultation',
    referralTotal: 'referral_total',
    linkageCompleted: 'linkage_completed',
    basicLivelihood: 'basic_livelihood',
    nearPoverty: 'near_poverty',
    emergencyWelfare: 'emergency_welfare',
    otherLinkage: 'other_linkage',
    underReview: 'under_review',
    noLinkageNeeded: 'no_linkage_needed',
  },
  referral: {
    serialNo: 'serial_no',
    institution: 'institution',
    visitType: 'visit_type',
    clientName: 'client_name',
    birthDate: 'birth_date',
    address: 'address',
    consultDate: 'consult_date',
    referralTarget: 'referral_target',
    consultationDone: 'consultation_done',
    linkageType: 'linkage_type',
    serviceDetails: 'service_details',
    underReview: 'under_review',
    noLinkageNeeded: 'no_linkage_needed',
  },
  generic: {
    region: 'region',
    organization: 'organization_name',
    itemName: 'item_name',
    inboundQuantity: 'inbound_quantity',
    outboundQuantity: 'outbound_quantity',
    stock: 'stock',
    inboundDate: 'inbound_date',
    expirationDate: 'expiration_date',
  },
};

const RECORD_TABLE: Record<SheetType, string> = {
  performance: 'performance_records',
  referral: 'referral_records',
  generic: 'inventory_records',
};

type DbRecordRow = Record<string, unknown> & { sheet_id: string };

/** DB 행들을 기존 미리보기 표가 쓰는 label-keyed SheetEntry로 되돌린다. */
function buildSheetEntry(
  sheetName: string,
  sheetType: SheetType,
  rows: DbRecordRow[],
): SheetEntry {
  const dbColumns = DB_COLUMN_BY_KEY[sheetType];
  const defs = getColumnsForType(sheetType).filter((def) => {
    const col = dbColumns[def.key];
    return col !== undefined && rows.some((r) => r[col] !== null && r[col] !== undefined);
  });

  const records = rows.map((row) => {
    const obj: Record<string, string> = {};
    for (const def of defs) {
      const val = row[dbColumns[def.key]!];
      if (val !== null && val !== undefined) obj[def.label] = String(val);
    }
    return obj;
  });

  return { sheetName, sheetType, columns: defs.map((d) => d.label), records };
}

export async function getSubmissionDetail(id: string): Promise<RemoteSubmissionDetail | null> {
  const sb = client();

  const { data: row, error } = await sb
    .from('submissions')
    .select(`${SUMMARY_SELECT}, sheets:submission_sheets(id, sheet_name, sheet_type, position)`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`자료를 불러오지 못했습니다: ${error.message}`);
  if (!row) return null;

  const sheetRows = (
    (row as unknown as { sheets: { id: string; sheet_name: string; sheet_type: string; position: number }[] })
      .sheets ?? []
  ).sort((a, b) => a.position - b.position);

  // 이 제출에 실제로 쓰인 유형의 테이블만 조회한다.
  const usedTypes = Array.from(new Set(sheetRows.map((s) => s.sheet_type))) as SheetType[];
  const rowsBySheet = new Map<string, DbRecordRow[]>();
  await Promise.all(
    usedTypes.map(async (type) => {
      const { data, error: recError } = await sb
        .from(RECORD_TABLE[type])
        .select('*')
        .eq('submission_id', id)
        .order('row_seq');
      if (recError) throw new Error(`자료 내용을 불러오지 못했습니다: ${recError.message}`);
      for (const rec of (data ?? []) as DbRecordRow[]) {
        const list = rowsBySheet.get(rec.sheet_id) ?? [];
        list.push(rec);
        rowsBySheet.set(rec.sheet_id, list);
      }
    }),
  );

  const sheets = sheetRows.map((s) =>
    buildSheetEntry(s.sheet_name, s.sheet_type as SheetType, rowsBySheet.get(s.id) ?? []),
  );

  return { summary: toSummary(row as unknown as SubmissionRow), sheets };
}

// ── 삭제 ─────────────────────────────────────────────────
export async function deleteSubmission(id: string): Promise<void> {
  const { error } = await client().rpc('delete_submission', { p_submission_id: id });
  if (error) throw new Error(`자료 삭제에 실패했습니다: ${error.message}`);
}
