-- Phase 3: 재고 계산 · 데이터 이상 판정 SSOT
--
-- 이 마이그레이션이 푸는 문제:
--   읍면동 서식에 `현재재고` 칸이 없거나 비어 있으면 `v_inventory_status.stock` 이 NULL 이 되고,
--   화면에는 "재고 0", 합계 KPI 에서는 아예 누락됐다. (실데이터 13품목 중 8품목이 이 상태)
--   반대로 값이 들어와도 출고 > 입고 같은 명백한 이상치를 아무도 잡지 않고 그대로 집계했다.
--
-- 원칙
--   1. 재고 계산과 이상 판정은 오직 `v_inventory_status` 한 곳에서만 한다.
--      화면(React)·다른 view 는 여기서 나온 값을 그대로 쓴다. 다시 계산하지 않는다.
--   2. 이상 데이터라도 원본 행은 절대 지우거나 막지 않는다. `확인 필요` 로 분리해 표시할 뿐이다.
--      (공공기관 원본 자료라 우리가 임의로 버릴 수 없다)
--   3. 유통기한 판정(is_expired / is_expiring_soon / days_to_expiration)은 Phase 2 규칙을
--      **한 글자도 바꾸지 않는다.** 이번 작업 범위가 아니다.
--
-- ── 원본 데이터가 실제로 어떤 모양인지 (2026-08-08 실제 제출 자료 확인 결과) ──
--
--   모양 A · 읍면동 표준 서식("물품 배분" 시트) — 품목당 1행, `현재재고` 있음
--     입고·출고는 그 기간의 누계, 현재재고는 기말 잔량이다.
--     실데이터 8행 전부에서 `현재재고 = 입고 − 출고` 가 정확히 성립했다. (8/8)
--     → 그래서 `입고 − 출고` 파생 계산이 이 서식의 의미와 일치한다. 필드명만 보고 추측한 게 아니다.
--
--   모양 B · 대량 제출 파일("물품 주간 재고" 시트) — 품목당 325행, `현재재고`·입고일 없음
--     한 행이 입출고 1건(로트 단위)이라 유통기한도 행마다 다르다.
--     이 모양에서는 합계(sum)만이 품목 잔량을 뜻하므로 `Σ입고 − Σ출고` 로 파생한다.
--
--   두 모양이 한 DB 에 공존하므로, 파생 계산의 기준(basis)을 아래처럼 나눠서 잡는다.

-- 의존하는 view 부터 내린다. (v_city_overview / v_region_usage 가 v_inventory_status 를 참조)
drop view if exists public.v_city_overview;
drop view if exists public.v_region_usage;
drop view if exists public.v_inventory_status;

-- ══ 재고 계산 · 이상 판정 SSOT ═══════════════════════════════
create view public.v_inventory_status
with (security_invoker = true) as
with latest as (
  -- 스냅샷 성격의 값(현재재고·유통기한)은 가장 최근 제출본의 행에서 가져온다. (Phase 2 와 동일)
  -- 정합성 검사에 쓰려고 그 행 자신의 입고·출고도 같이 들고 온다.
  select distinct on (organization_id, item_name)
    organization_id,
    item_name,
    stock              as reported_stock,
    inbound_quantity   as row_inbound,
    outbound_quantity  as row_outbound,
    expiration_date,
    inbound_date,
    uploaded_at
  from public.v_inventory_rows
  where item_name is not null
  order by organization_id, item_name, uploaded_at desc, row_seq desc
),
flows as (
  -- 입고·출고는 기간 누적이라 합계를 쓴다. (Phase 2 와 동일)
  -- valued_row_count: 입고·출고 중 하나라도 값이 들어온 행 수.
  --   0 이면 더할 근거 자체가 없다는 뜻이라 파생 계산을 하면 안 된다. (0 으로 단정하지 않는다)
  select
    organization_id,
    item_name,
    sum(coalesce(inbound_quantity, 0))  as inbound_quantity,
    sum(coalesce(outbound_quantity, 0)) as outbound_quantity,
    count(*)                            as record_count,
    count(*) filter (
      where inbound_quantity is not null or outbound_quantity is not null
    )                                   as valued_row_count
  from public.v_inventory_rows
  where item_name is not null
  group by organization_id, item_name
),
resolved as (
  select
    l.organization_id,
    l.item_name,
    f.inbound_quantity,
    f.outbound_quantity,
    f.record_count,
    f.valued_row_count,
    l.reported_stock,
    l.row_inbound,
    l.row_outbound,
    l.inbound_date,
    l.expiration_date,
    l.uploaded_at,

    -- ── 재고 계산 규칙 (SSOT) ──
    --   1) 원본 `현재재고` 가 있으면 그 값을 그대로 쓴다. (기관이 보고한 값이 우선)
    --   2) 없으면 `Σ입고 − Σ출고` 로 파생한다.
    --   3) 더할 근거조차 없으면 NULL. 0 으로 단정하지 않는다.
    case
      when l.reported_stock is not null then l.reported_stock
      when f.valued_row_count > 0       then f.inbound_quantity - f.outbound_quantity
    end as stock,
    case
      when l.reported_stock is not null then 'reported'
      when f.valued_row_count > 0       then 'derived'
      else                                   'unknown'
    end as stock_source,

    -- ── 이상 판정 ──
    -- (1) 출고 > 입고 : 품목 전체 누계 기준. 화면에 보여주는 입고량·배부량과 같은 기준이다.
    (f.outbound_quantity > f.inbound_quantity) as has_outbound_over_inbound,

    -- (2) 보고된 현재재고가 그 행 자신의 `입고 − 출고` 와 불일치
    --     품목 누계가 아니라 **해당 행 자체**로 비교한다. 한 기관이 여러 주차를 각각 올리면
    --     누계와 기말 잔량은 원래 다르므로, 누계로 비교하면 정상 자료가 오탐된다.
    (
      l.reported_stock is not null
      and l.row_inbound is not null
      and l.row_outbound is not null
      and l.reported_stock <> (l.row_inbound - l.row_outbound)
    ) as has_stock_mismatch,

    -- (4) 재고를 계산할 근거가 아예 없음 (현재재고도 없고 입고·출고도 전부 비어 있음)
    (l.reported_stock is null and f.valued_row_count = 0) as has_missing_basis
  from latest l
  join flows f on f.organization_id = l.organization_id and f.item_name = l.item_name
),
flagged as (
  select
    r.*,
    -- (3) 계산 결과 재고가 음수
    (r.stock is not null and r.stock < 0) as has_negative_stock
  from resolved r
),
scored as (
  select
    f.*,
    (
      f.has_outbound_over_inbound
      or f.has_stock_mismatch
      or f.has_missing_basis
      or f.has_negative_stock
    ) as has_anomaly,
    -- 어떤 이상인지 구조적으로 남긴다. 화면은 이 배열만 읽으면 사유를 그대로 쓸 수 있다.
    array_remove(array[
      case when f.has_outbound_over_inbound then 'outbound_over_inbound' end,
      case when f.has_negative_stock        then 'negative_stock'        end,
      case when f.has_stock_mismatch        then 'stock_mismatch'        end,
      case when f.has_missing_basis         then 'missing_basis'         end
    ], null) as anomaly_codes
  from flagged f
)
select
  o.id                      as organization_id,
  o.name                    as organization_name,
  o.region_id,
  o.region_name,
  s.item_name,
  s.inbound_quantity,
  s.outbound_quantity,
  s.stock,
  s.stock_source,
  s.record_count,
  s.inbound_date            as last_inbound_date,
  s.expiration_date,
  s.uploaded_at             as last_reported_at,

  -- ── 유통기한 (Phase 2 규칙 그대로. 변경 없음) ──
  (s.expiration_date is not null and s.expiration_date < current_date)                        as is_expired,
  (s.expiration_date is not null and s.expiration_date >= current_date
     and s.expiration_date <= current_date + interval '30 days')                              as is_expiring_soon,
  case when s.expiration_date is null then null
       else (s.expiration_date - current_date) end                                            as days_to_expiration,

  -- ── 이상 판정 결과 ──
  s.has_outbound_over_inbound,
  s.has_negative_stock,
  s.has_stock_mismatch,
  s.has_missing_basis,
  s.has_anomaly,
  s.anomaly_codes,

  -- 합계 KPI 전용. 이상 품목의 재고는 합계에 섞지 않는다. (행 자체는 그대로 남는다)
  case when s.has_anomaly then null else s.stock end as trusted_stock,

  -- ── 상태 라벨 (SSOT) ──
  -- 우선순위: 확인 필요 > 임박 > 부족 > 정상
  --   · 재고를 신뢰할 수 없으면(이상 판정) 부족·정상 어느 쪽도 단정할 수 없으므로 확인 필요가 앞선다.
  --   · 기한 경과를 확인 필요로 보는 것, 부족 기준을 `재고 <= 0` 으로 두는 것은
  --     기존 규칙(utils/inventoryStatus.ts) 그대로다. 새 기준을 만들지 않았다.
  case
    when s.has_anomaly                                                    then '확인 필요'
    when s.expiration_date is not null and s.expiration_date < current_date
                                                                          then '확인 필요'
    when s.expiration_date is not null and s.expiration_date >= current_date
         and s.expiration_date <= current_date + interval '30 days'       then '임박'
    when s.stock is not null and s.stock <= 0                             then '부족'
    else                                                                       '정상'
  end as status
from scored s
join public.organizations o on o.id = s.organization_id;

-- ══ 재생성: 읍면동별 실적 ══════════════════════════════════
-- Phase 2 와 동일하되 재고 합계만 `trusted_stock` 기준으로 바꾼다.
-- 이상 품목의 재고(예: 음수)를 합계에 넣으면 읍면동 KPI 가 통째로 틀어지기 때문이다.
-- 대신 몇 품목이 확인 필요인지 `unverified_item_count` 로 함께 내려준다.
create view public.v_region_usage
with (security_invoker = true) as
select
  o.id   as organization_id,
  o.name as organization_name,
  o.region_id,
  o.region_name,
  coalesce(p.user_count, 0)          as user_count,
  coalesce(p.basic_consultation, 0)  as basic_consultation,
  coalesce(p.referral_total, 0)      as referral_total,
  coalesce(p.linkage_completed, 0)   as linkage_completed,
  coalesce(p.under_review, 0)        as under_review,
  coalesce(p.no_linkage_needed, 0)   as no_linkage_needed,
  coalesce(r.referral_count, 0)      as referral_count,
  coalesce(i.item_count, 0)          as item_count,
  coalesce(i.total_stock, 0)         as total_stock,
  coalesce(i.unverified_item_count, 0) as unverified_item_count,
  s.submission_count,
  s.last_uploaded_at,
  s.period_start,
  s.period_end
from public.organizations o
join (
  select organization_id,
         count(*)          as submission_count,
         max(uploaded_at)  as last_uploaded_at,
         min(period_start) as period_start,
         max(period_end)   as period_end
  from public.v_active_submissions
  group by organization_id
) s on s.organization_id = o.id
left join (
  select organization_id,
         sum(coalesce(user_count, 0))         as user_count,
         sum(coalesce(basic_consultation, 0)) as basic_consultation,
         sum(coalesce(referral_total, 0))     as referral_total,
         sum(coalesce(linkage_completed, 0))  as linkage_completed,
         sum(coalesce(under_review, 0))       as under_review,
         sum(coalesce(no_linkage_needed, 0))  as no_linkage_needed
  from public.v_performance_rows
  group by organization_id
) p on p.organization_id = o.id
left join (
  select organization_id, count(*) as referral_count
  from public.v_referral_rows
  group by organization_id
) r on r.organization_id = o.id
left join (
  select organization_id,
         count(*)                                  as item_count,
         sum(coalesce(trusted_stock, 0))           as total_stock,
         count(*) filter (where has_anomaly)       as unverified_item_count
  from public.v_inventory_status
  group by organization_id
) i on i.organization_id = o.id;

-- ══ 재생성: 화성시 전체 통합 KPI ═══════════════════════════
-- Phase 2 와 동일하되 재고 합계를 `trusted_stock` 기준으로 바꾸고
-- 확인 필요 품목 수를 새로 내려준다. 유통기한 KPI 는 그대로다.
create view public.v_city_overview
with (security_invoker = true) as
select
  (select count(*)                        from public.v_active_submissions)                  as submission_count,
  (select count(distinct organization_id) from public.v_active_submissions)                  as organization_count,
  (select coalesce(sum(user_count), 0)         from public.v_performance_rows)               as total_users,
  (select coalesce(sum(basic_consultation), 0) from public.v_performance_rows)               as total_consultations,
  (select coalesce(sum(referral_total), 0)     from public.v_performance_rows)               as total_referrals,
  (select coalesce(sum(linkage_completed), 0)  from public.v_performance_rows)               as total_linkage_completed,
  (select coalesce(sum(basic_livelihood), 0)   from public.v_performance_rows)               as total_basic_livelihood,
  (select coalesce(sum(near_poverty), 0)       from public.v_performance_rows)               as total_near_poverty,
  (select coalesce(sum(emergency_welfare), 0)  from public.v_performance_rows)               as total_emergency_welfare,
  (select coalesce(sum(other_linkage), 0)      from public.v_performance_rows)               as total_other_linkage,
  (select coalesce(sum(under_review), 0)       from public.v_performance_rows)               as total_under_review,
  (select coalesce(sum(no_linkage_needed), 0)  from public.v_performance_rows)               as total_no_linkage_needed,
  (select count(*)                        from public.v_referral_rows)                       as referral_record_count,
  (select count(*)                        from public.v_inventory_status)                    as inventory_item_count,
  (select coalesce(sum(trusted_stock), 0) from public.v_inventory_status)                    as inventory_total_stock,
  (select count(*)                        from public.v_inventory_status where is_expiring_soon) as expiring_soon_count,
  (select count(*)                        from public.v_inventory_status where is_expired)   as expired_count,
  (select count(*)                        from public.v_inventory_status where has_anomaly)  as unverified_item_count,
  (select min(period_start)               from public.v_active_submissions)                  as period_start,
  (select max(period_end)                 from public.v_active_submissions)                  as period_end,
  (select max(uploaded_at)                from public.v_active_submissions)                  as last_uploaded_at;

grant select on
  public.v_inventory_status,
  public.v_region_usage,
  public.v_city_overview
to anon, authenticated;
