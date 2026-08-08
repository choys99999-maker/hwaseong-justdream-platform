// 중앙 집계 조회 계층 (Phase 2).
// 모든 소비 화면은 IndexedDB의 "활성 자료 1개"가 아니라 여기서 읽는다.
// 집계 규칙(최신 제출본만/누계 시트 제외/유통기한 임박)은 전부 SQL view 쪽에 있다.
import { supabase } from '../lib/supabase';

function client() {
  if (!supabase) throw new Error('중앙 저장소가 설정되지 않았습니다.');
  return supabase;
}

function fail(what: string, message: string): never {
  throw new Error(`${what}을(를) 불러오지 못했습니다: ${message}`);
}

// ── 화성시 전체 통합 KPI ──────────────────────────────────
export interface CityOverview {
  submissionCount: number;
  organizationCount: number;
  totalUsers: number;
  totalConsultations: number;
  totalReferrals: number;
  totalLinkageCompleted: number;
  totalUnderReview: number;
  totalNoLinkageNeeded: number;
  referralRecordCount: number;
  inventoryItemCount: number;
  inventoryTotalStock: number;
  expiringSoonCount: number;
  expiredCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  lastUploadedAt: string | null;
}

export async function getCityOverview(): Promise<CityOverview> {
  const { data, error } = await client().from('v_city_overview').select('*').maybeSingle();
  if (error) fail('통합 현황', error.message);
  const r = (data ?? {}) as Record<string, number | string | null>;
  const num = (k: string) => Number(r[k] ?? 0);
  return {
    submissionCount: num('submission_count'),
    organizationCount: num('organization_count'),
    totalUsers: num('total_users'),
    totalConsultations: num('total_consultations'),
    totalReferrals: num('total_referrals'),
    totalLinkageCompleted: num('total_linkage_completed'),
    totalUnderReview: num('total_under_review'),
    totalNoLinkageNeeded: num('total_no_linkage_needed'),
    referralRecordCount: num('referral_record_count'),
    inventoryItemCount: num('inventory_item_count'),
    inventoryTotalStock: num('inventory_total_stock'),
    expiringSoonCount: num('expiring_soon_count'),
    expiredCount: num('expired_count'),
    periodStart: (r['period_start'] as string) ?? null,
    periodEnd: (r['period_end'] as string) ?? null,
    lastUploadedAt: (r['last_uploaded_at'] as string) ?? null,
  };
}

// ── 읍면동별 실적 ─────────────────────────────────────────
export interface RegionUsage {
  organizationId: string;
  organizationName: string;
  regionId: string;
  regionName: string;
  userCount: number;
  basicConsultation: number;
  referralTotal: number;
  linkageCompleted: number;
  underReview: number;
  noLinkageNeeded: number;
  referralCount: number;
  itemCount: number;
  totalStock: number;
  submissionCount: number;
  lastUploadedAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

function toRegionUsage(r: Record<string, unknown>): RegionUsage {
  return {
    organizationId: String(r.organization_id),
    organizationName: String(r.organization_name),
    regionId: String(r.region_id),
    regionName: String(r.region_name),
    userCount: Number(r.user_count ?? 0),
    basicConsultation: Number(r.basic_consultation ?? 0),
    referralTotal: Number(r.referral_total ?? 0),
    linkageCompleted: Number(r.linkage_completed ?? 0),
    underReview: Number(r.under_review ?? 0),
    noLinkageNeeded: Number(r.no_linkage_needed ?? 0),
    referralCount: Number(r.referral_count ?? 0),
    itemCount: Number(r.item_count ?? 0),
    totalStock: Number(r.total_stock ?? 0),
    submissionCount: Number(r.submission_count ?? 0),
    lastUploadedAt: (r.last_uploaded_at as string) ?? null,
    periodStart: (r.period_start as string) ?? null,
    periodEnd: (r.period_end as string) ?? null,
  };
}

export async function listRegionUsage(): Promise<RegionUsage[]> {
  const { data, error } = await client()
    .from('v_region_usage')
    .select('*')
    .order('user_count', { ascending: false });
  if (error) fail('지역별 현황', error.message);
  return (data ?? []).map(toRegionUsage);
}

/** 지역 상세. URL의 읍면동 이름으로 찾는다. */
export async function getRegionUsage(organizationName: string): Promise<RegionUsage | null> {
  const { data, error } = await client()
    .from('v_region_usage')
    .select('*')
    .eq('organization_name', organizationName)
    .maybeSingle();
  if (error) fail('지역 현황', error.message);
  return data ? toRegionUsage(data as Record<string, unknown>) : null;
}

// ── 물품·재고 ─────────────────────────────────────────────
export interface InventoryStatus {
  organizationId: string;
  organizationName: string;
  regionName: string;
  itemName: string;
  inboundQuantity: number;
  outboundQuantity: number;
  stock: number;
  lastInboundDate: string | null;
  expirationDate: string | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysToExpiration: number | null;
}

export async function listInventoryStatus(): Promise<InventoryStatus[]> {
  const { data, error } = await client()
    .from('v_inventory_status')
    .select('*')
    .order('organization_name')
    .order('item_name');
  if (error) fail('재고 현황', error.message);
  return (data ?? []).map((r) => ({
    organizationId: String(r.organization_id),
    organizationName: String(r.organization_name),
    regionName: String(r.region_name),
    itemName: String(r.item_name),
    inboundQuantity: Number(r.inbound_quantity ?? 0),
    outboundQuantity: Number(r.outbound_quantity ?? 0),
    stock: Number(r.stock ?? 0),
    lastInboundDate: (r.last_inbound_date as string) ?? null,
    expirationDate: (r.expiration_date as string) ?? null,
    isExpired: Boolean(r.is_expired),
    isExpiringSoon: Boolean(r.is_expiring_soon),
    daysToExpiration: r.days_to_expiration === null ? null : Number(r.days_to_expiration),
  }));
}

// ── 복지연계 집계 (개인정보 없음) ─────────────────────────
export interface WelfareLinkage {
  organizationId: string;
  organizationName: string;
  regionName: string;
  referralCount: number;
  visitCount: number;
  consultationDoneCount: number;
  linkageCompletedCount: number;
  firstConsultDate: string | null;
  lastConsultDate: string | null;
}

export async function listWelfareLinkage(): Promise<WelfareLinkage[]> {
  const { data, error } = await client()
    .from('v_welfare_linkage')
    .select('*')
    .order('referral_count', { ascending: false });
  if (error) fail('복지연계 현황', error.message);
  return (data ?? []).map((r) => ({
    organizationId: String(r.organization_id),
    organizationName: String(r.organization_name),
    regionName: String(r.region_name),
    referralCount: Number(r.referral_count ?? 0),
    visitCount: Number(r.visit_count ?? 0),
    consultationDoneCount: Number(r.consultation_done_count ?? 0),
    linkageCompletedCount: Number(r.linkage_completed_count ?? 0),
    firstConsultDate: (r.first_consult_date as string) ?? null,
    lastConsultDate: (r.last_consult_date as string) ?? null,
  }));
}

// ── 기관별 제출 현황 ──────────────────────────────────────
export interface SubmissionStatus {
  organizationId: string;
  organizationName: string;
  regionName: string;
  submissionId: string;
  fileName: string;
  recordCount: number;
  issueCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  lastUploadedAt: string;
  submissionCount: number;
}

export async function listSubmissionStatus(): Promise<SubmissionStatus[]> {
  const { data, error } = await client()
    .from('v_submission_status')
    .select('*')
    .order('last_uploaded_at', { ascending: false });
  if (error) fail('제출 현황', error.message);
  return (data ?? []).map((r) => ({
    organizationId: String(r.organization_id),
    organizationName: String(r.organization_name),
    regionName: String(r.region_name),
    submissionId: String(r.submission_id),
    fileName: String(r.file_name),
    recordCount: Number(r.record_count ?? 0),
    issueCount: Number(r.issue_count ?? 0),
    periodStart: (r.period_start as string) ?? null,
    periodEnd: (r.period_end as string) ?? null,
    lastUploadedAt: String(r.last_uploaded_at),
    submissionCount: Number(r.submission_count ?? 0),
  }));
}

// ── 월별 활동량 (차트) ────────────────────────────────────
export interface MonthlyPoint {
  month: string;
  count: number;
}

/** organizationId를 주면 그 지역만, 없으면 화성시 전체를 월별로 합친다. */
export async function listMonthlyActivity(organizationId?: string): Promise<MonthlyPoint[]> {
  let query = client().from('v_monthly_activity').select('month, count').order('month');
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { data, error } = await query;
  if (error) fail('월별 현황', error.message);

  const merged = new Map<string, number>();
  for (const row of data ?? []) {
    const month = String(row.month);
    merged.set(month, (merged.get(month) ?? 0) + Number(row.count ?? 0));
  }
  return Array.from(merged, ([month, count]) => ({ month, count })).sort((a, b) =>
    a.month.localeCompare(b.month),
  );
}

/** 기관 단위 월별 활동량. 여러 읍면동을 구 단위로 묶을 때 쓴다. */
export interface OrgMonthlyPoint extends MonthlyPoint {
  organizationId: string;
}

export async function listMonthlyActivityRows(): Promise<OrgMonthlyPoint[]> {
  const { data, error } = await client()
    .from('v_monthly_activity')
    .select('organization_id, month, count')
    .order('month');
  if (error) fail('월별 현황', error.message);
  return (data ?? []).map((row) => ({
    organizationId: String(row.organization_id),
    month: String(row.month),
    count: Number(row.count ?? 0),
  }));
}

/** 월별 포인트들을 월 기준으로 합친다. (여러 읍면동 → 구 단위 추이) */
export function mergeMonthlyPoints(points: MonthlyPoint[]): MonthlyPoint[] {
  const merged = new Map<string, number>();
  for (const point of points) {
    merged.set(point.month, (merged.get(point.month) ?? 0) + point.count);
  }
  return Array.from(merged, ([month, count]) => ({ month, count })).sort((a, b) =>
    a.month.localeCompare(b.month),
  );
}

/** 차트 X축 라벨. '2026-08' → '8월' */
export function monthLabel(month: string): string {
  const m = month.split('-')[1];
  return m ? `${parseInt(m, 10)}월` : month;
}

// ── 실적 원본 행 (실적·복지연계 화면) ────────────────────
// v_region_usage 는 기관별 합계만 주고 기초생활·차상위·긴급복지·기타 항목이 없다.
// 실적 서식 그대로의 표를 그리려면 행 단위로 읽어 화면에서 묶는다.
// (이 view 는 이미 "유효한 제출본 + 누계 시트 제외" 를 적용한 뒤의 행이다)
export interface PerformanceRow {
  submissionId: string;
  organizationId: string;
  organizationName: string;
  regionName: string;
  institution: string | null;
  uploadedAt: string;
  userCount: number;
  basicConsultation: number;
  referralTotal: number;
  linkageCompleted: number;
  basicLivelihood: number;
  nearPoverty: number;
  emergencyWelfare: number;
  otherLinkage: number;
  underReview: number;
  noLinkageNeeded: number;
}

export async function listPerformanceRows(): Promise<PerformanceRow[]> {
  const { data, error } = await client()
    .from('v_performance_rows')
    .select(
      'submission_id, organization_id, organization_name, region_name, institution, uploaded_at, ' +
        'user_count, basic_consultation, referral_total, linkage_completed, basic_livelihood, ' +
        'near_poverty, emergency_welfare, other_linkage, under_review, no_linkage_needed',
    )
    .order('uploaded_at', { ascending: false });
  if (error) fail('실적 내역', error.message);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    submissionId: String(r.submission_id),
    organizationId: String(r.organization_id),
    organizationName: String(r.organization_name),
    regionName: String(r.region_name ?? ''),
    institution: (r.institution as string) ?? null,
    uploadedAt: String(r.uploaded_at),
    userCount: Number(r.user_count ?? 0),
    basicConsultation: Number(r.basic_consultation ?? 0),
    referralTotal: Number(r.referral_total ?? 0),
    linkageCompleted: Number(r.linkage_completed ?? 0),
    basicLivelihood: Number(r.basic_livelihood ?? 0),
    nearPoverty: Number(r.near_poverty ?? 0),
    emergencyWelfare: Number(r.emergency_welfare ?? 0),
    otherLinkage: Number(r.other_linkage ?? 0),
    underReview: Number(r.under_review ?? 0),
    noLinkageNeeded: Number(r.no_linkage_needed ?? 0),
  }));
}

// ── 지역 상세의 복지연계 내역 (개인정보는 화면에서 마스킹) ──
export interface ReferralRow {
  serialNo: number | null;
  visitType: string | null;
  clientName: string | null;
  birthDate: string | null;
  address: string | null;
  consultDate: string | null;
  referralTarget: string | null;
  consultationDone: string | null;
  linkageType: string | null;
  serviceDetails: string | null;
}

/** 시 전체 복지연계 내역. 어느 기관이 올린 행인지까지 함께 온다. */
export interface CityReferralRow extends ReferralRow {
  organizationId: string;
  organizationName: string;
  regionName: string;
}

const REFERRAL_SELECT =
  'serial_no, visit_type, client_name, birth_date, address, consult_date, ' +
  'referral_target, consultation_done, linkage_type, service_details';

function toReferralRow(r: Record<string, unknown>): ReferralRow {
  return {
    serialNo: r.serial_no === null || r.serial_no === undefined ? null : Number(r.serial_no),
    visitType: (r.visit_type as string) ?? null,
    clientName: (r.client_name as string) ?? null,
    birthDate: (r.birth_date as string) ?? null,
    address: (r.address as string) ?? null,
    consultDate: (r.consult_date as string) ?? null,
    referralTarget: (r.referral_target as string) ?? null,
    consultationDone: (r.consultation_done as string) ?? null,
    linkageType: (r.linkage_type as string) ?? null,
    serviceDetails: (r.service_details as string) ?? null,
  };
}

/**
 * 시 전체 복지연계 내역.
 * ⚠️ 개인 식별 항목(이름·생년월일·주소)이 그대로 들어 있다.
 *    화면에 그릴 때는 반드시 utils/submission 의 마스킹을 거친다.
 */
export async function listAllReferralRows(
  limit = 300,
  organizationIds?: string[],
): Promise<CityReferralRow[]> {
  let query = client()
    .from('v_referral_rows')
    .select(`organization_id, organization_name, region_name, ${REFERRAL_SELECT}`);
  // 구 상세처럼 일부 읍면동만 볼 때는 DB에서 걸러야 limit 이 제 몫을 한다.
  if (organizationIds) {
    if (organizationIds.length === 0) return [];
    query = query.in('organization_id', organizationIds);
  }
  const { data, error } = await query
    .order('consult_date', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) fail('복지연계 내역', error.message);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    ...toReferralRow(r),
    organizationId: String(r.organization_id),
    organizationName: String(r.organization_name),
    regionName: String(r.region_name ?? ''),
  }));
}

export async function listReferralRows(
  organizationId: string,
  limit = 50,
): Promise<ReferralRow[]> {
  const { data, error } = await client()
    .from('v_referral_rows')
    .select(REFERRAL_SELECT)
    .eq('organization_id', organizationId)
    .order('consult_date', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) fail('복지연계 내역', error.message);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toReferralRow);
}
