import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import CitizenLayout from './components/layout/CitizenLayout';
import AdminLayout from './components/layout/AdminLayout';
import CitizenHomePage from './pages/citizen/CitizenHomePage';
import CitizenSiteDetailPage from './pages/citizen/CitizenSiteDetailPage';
import CitizenHelpPage from './pages/citizen/CitizenHelpPage';
import CitizenEasyModePage from './pages/citizen/CitizenEasyModePage';
import CitizenInfoPage from './pages/citizen/CitizenInfoPage';
import CitizenFeedbackPage from './pages/citizen/CitizenFeedbackPage';
import CitizenGuidePage from './pages/citizen/CitizenGuidePage';
import CitizenDonatePage from './pages/citizen/CitizenDonatePage';
import DashboardPage from './pages/DashboardPage';
import RegionListPage from './pages/RegionListPage';
import RegionDetailPage from './pages/RegionDetailPage';
import UsageSupportPage from './pages/UsageSupportPage';
import WelfareLinkagePage from './pages/WelfareLinkagePage';
import InventoryPage from './pages/InventoryPage';
import QuickSiteStatusPage from './pages/QuickSiteStatusPage';
import PhoneHelpRequestPage from './pages/PhoneHelpRequestPage';
import DataLibraryPage from './pages/DataLibraryPage';
import DataUploadPage from './pages/DataUploadPage';
import SubmissionDetailPage from './pages/SubmissionDetailPage';

/** 예전 `/regions/:regionId` · `/files/:submissionId` 같은 파라미터 경로를 그대로 옮긴다. */
function ParamRedirect({ to }: { to: (params: Readonly<Record<string, string | undefined>>) => string }) {
  const params = useParams();
  return <Navigate to={to(params)} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* 시민 화면 — "지금 어디로 가면 실제로 받을 수 있지?" 에 답하는 첫 화면이다. */}
      <Route element={<CitizenLayout />}>
        <Route path="/" element={<CitizenHomePage />} />
        <Route path="/site/:id" element={<CitizenSiteDetailPage />} />
        <Route path="/help" element={<CitizenHelpPage />} />
        <Route path="/easy" element={<CitizenEasyModePage />} />
        <Route path="/donate" element={<CitizenDonatePage />} />
        <Route path="/info" element={<CitizenInfoPage />} />
        <Route path="/feedback" element={<CitizenFeedbackPage />} />
        <Route path="/guide" element={<CitizenGuidePage />} />
      </Route>

      {/* 관리자 화면 — 기존 로직은 그대로, 경로만 /admin 아래로 옮긴다. */}
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<DashboardPage />} />
        <Route path="/admin/inventory" element={<InventoryPage />} />
        <Route path="/admin/quick-status" element={<QuickSiteStatusPage />} />
        <Route path="/admin/help-requests/new" element={<PhoneHelpRequestPage />} />
        <Route path="/admin/usage" element={<UsageSupportPage />} />
        <Route path="/admin/welfare-linkage" element={<WelfareLinkagePage />} />
        <Route path="/admin/regions" element={<RegionListPage />} />
        <Route path="/admin/regions/:regionId" element={<RegionDetailPage />} />
        <Route path="/admin/files" element={<DataLibraryPage />} />
        <Route path="/admin/files/upload" element={<DataUploadPage />} />
        <Route path="/admin/files/:submissionId" element={<SubmissionDetailPage />} />
      </Route>

      {/* 예전 관리자 경로 호환 — 루트가 시민 화면으로 바뀌면서 전부 /admin 아래로 이동했다. */}
      <Route path="/regions" element={<Navigate to="/admin/regions" replace />} />
      <Route path="/regions/:regionId" element={<ParamRedirect to={(p) => `/admin/regions/${p.regionId}`} />} />
      <Route path="/inventory" element={<Navigate to="/admin/inventory" replace />} />
      <Route path="/usage" element={<Navigate to="/admin/usage" replace />} />
      <Route path="/welfare-linkage" element={<Navigate to="/admin/welfare-linkage" replace />} />
      <Route path="/files" element={<Navigate to="/admin/files" replace />} />
      <Route path="/files/upload" element={<Navigate to="/admin/files/upload" replace />} />
      <Route path="/files/:submissionId" element={<ParamRedirect to={(p) => `/admin/files/${p.submissionId}`} />} />
      {/* 배분·재배분 화면은 제품 정의에서 제외했다 — 가장 가까운 화면(물품 현황)으로 보낸다. */}
      <Route path="/redistribution" element={<Navigate to="/admin/inventory" replace />} />
      <Route path="/forecast" element={<Navigate to="/admin/inventory" replace />} />
      <Route path="/performance" element={<Navigate to="/admin/usage?tab=records" replace />} />
      <Route path="/support-records" element={<Navigate to="/admin/usage" replace />} />
      <Route path="/upload" element={<Navigate to="/admin/files/upload" replace />} />

      {/* 나머지 알 수 없는 경로는 시민 홈으로 — 이 서비스는 이제 시민 대상이 기본이다. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
