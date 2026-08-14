import PageHeader from '../../components/common/PageHeader';
import AdminToday from '../../components/today/AdminToday';
import FieldToday from '../../components/today/FieldToday';
import { useAdminRole } from '../../hooks/useAdminRole';

/**
 * 오늘 할 일 — 관리자 PC의 첫 화면.
 *
 * 같은 데이터를 쓰지만 역할에 따라 우선순위가 다르다.
 *   - 시청 관리자 : 화성시 전체에서 확인·조치할 곳
 *   - 현장 담당자 : 우리 거점에서 입력·처리할 것
 * 역할 전환은 상단 바에서 한다.
 */
export default function TodayPage() {
  const { role } = useAdminRole();

  return (
    <div>
      <PageHeader
        title="오늘 할 일"
        description={
          role === 'admin'
            ? '지금 확인하고 조치해야 할 건을 먼저 보여 드립니다. 통계는 화면 맨 아래에 있습니다.'
            : '우리 거점에서 지금 입력할 것과 처리할 건만 모았습니다.'
        }
      />
      {role === 'admin' ? <AdminToday /> : <FieldToday />}
    </div>
  );
}
