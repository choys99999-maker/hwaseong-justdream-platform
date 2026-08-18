import OperationMapSection from '../dashboard/OperationMapSection';

/**
 * 시청 관리자 첫 화면 — 화성시 그냥드림 운영 현황판.
 *
 * 정보 흐름은 세 단계뿐이다: 전체 상태(KPI) → 어디가 문제인지(지도) → 문제 거점 확인(우측 패널).
 * 이 세 단계 안에 다 들어가는 KPI·지도·패널은 OperationMapSection 하나가 함께 관리한다
 * (KPI 선택이 곧 지도 필터이자 패널 내용 기준이라 상태를 나눠 두면 서로 어긋난다).
 *
 * 시민 요청·기부 전체 목록, 거점별 재고 표, 보조 통계 같은 "수십 건을 펼쳐 보여주는" 화면은
 * 여기 없다 — 각각 시민 요청/거점 관리 메뉴에 그대로 남아 있다.
 */
export default function AdminToday() {
  return (
    <section aria-label="화성시 거점 운영 현황">
      <OperationMapSection />
    </section>
  );
}
