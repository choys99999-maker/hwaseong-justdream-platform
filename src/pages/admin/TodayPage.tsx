import PageHeader from '../../components/common/PageHeader';
import AdminToday from '../../components/today/AdminToday';
import FieldToday from '../../components/today/FieldToday';
import { useAdminRole } from '../../hooks/useAdminRole';

/**
 * 운영 현황 — 관리자 PC의 첫 화면.
 *
 * 같은 데이터를 쓰지만 역할에 따라 우선순위가 다르다.
 *   - 시청 관리자 : 화성시 전체 거점의 운영 상태와 확인이 필요한 곳
 *   - 현장 담당자 : 우리 거점에서 입력·처리할 것
 * 역할 전환은 우측 상단 프로필 메뉴에서 한다.
 */
export default function TodayPage() {
  const { role } = useAdminRole();

  // 시청 관리자 화면은 AdminToday 안의 hero 헤드라인이 제목 역할을 겸한다
  // (화성시 지도를 첫 화면의 주인공으로 두기 위한 재설계 — section 7 참고).
  if (role === 'admin') return <AdminToday />;

  return (
    <div>
      <PageHeader
        title="운영 현황"
        description="우리 거점에서 지금 입력할 것과 처리할 건만 모았습니다."
      />
      <FieldToday />
    </div>
  );
}
