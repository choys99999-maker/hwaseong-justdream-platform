import PageHeader from '../components/common/PageHeader';
import CounselingLinkageTab from '../components/usage/CounselingLinkageTab';

/**
 * 복지연계 현황 — 그냥드림 사업 안에서의 연계 진행 상태만 관리한다.
 * (상담 필요 → 연계 요청 → 공식 복지행정 처리 → 연계 완료)
 * 실제 복지 서비스 결정·심사·행정처리는 행복e음 영역이며, 여기서는 다루지 않는다.
 */
export default function WelfareLinkagePage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="복지연계 현황"
        description="상담 필요 → 연계 요청 → 읍면동 처리 → 연계 완료로 이어지는 진행 상태를 관리합니다. 심사·행정처리는 행복e음에서 진행합니다."
      />
      <CounselingLinkageTab />
    </div>
  );
}
