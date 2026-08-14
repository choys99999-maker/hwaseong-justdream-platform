import MonthlyFlowChart from '../charts/MonthlyFlowChart';
import DistrictRiskChart from '../charts/DistrictRiskChart';
import PerformanceRecordsTab from '../../pages/PerformancePage';

/**
 * 분석.
 *
 * 매일 쓰는 기능이 아니라 자료를 걷은 뒤 돌아보는 화면이라 독립 메뉴에서 내려
 * [자료 관리 > 분석] 안에 둔다. 값은 전부 제출 자료에서 계산한 것이고 예측은 하지 않는다.
 */
export default function DataAnalysisView() {
  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">지원 실적</h3>
        <PerformanceRecordsTab />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">추이</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <MonthlyFlowChart />
          <DistrictRiskChart />
        </div>
      </section>
    </div>
  );
}
