import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import CitizenLayout from './components/layout/CitizenLayout';
import AdminLayout from './components/layout/AdminLayout';

// 시민 화면
import HomePage from './pages/citizen/HomePage';
import CitizenSiteDetailPage from './pages/citizen/CitizenSiteDetailPage';
import ItemSearchPage from './pages/citizen/ItemSearchPage';
import CitizenHelpPage from './pages/citizen/CitizenHelpPage';
import DeliveryRequestPage from './pages/citizen/DeliveryRequestPage';
import CitizenDonatePage from './pages/citizen/CitizenDonatePage';
import CitizenInfoPage from './pages/citizen/CitizenInfoPage';
import CitizenFeedbackPage from './pages/citizen/CitizenFeedbackPage';
import CitizenGuidePage from './pages/citizen/CitizenGuidePage';

// 관리자 페이지
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

function ParamRedirect({ to }: { to: (params: Readonly<Record<string, string | undefined>>) => string }) {
  const params = useParams();
  return <Navigate to={to(params)} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* ── 시민 화면 ── */}
      <Route element={<CitizenLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/site/:id" element={<CitizenSiteDetailPage />} />
        <Route path="/items" element={<ItemSearchPage />} />
        <Route path="/help" element={<CitizenHelpPage />} />
        <Route path="/delivery" element={<DeliveryRequestPage />} />
        <Route path="/donate" element={<CitizenDonatePage />} />
        <Route path="/info" element={<CitizenInfoPage />} />
        <Route path="/feedback" element={<CitizenFeedbackPage />} />
        <Route path="/guide" element={<CitizenGuidePage />} />
      </Route>

      {/*
        예전 시민 경로. 지도 화면이 /discover · /map 두 벌, 큰 글씨 전용 화면이 /easy 로
        따로 있었는데, 이제 지도 홈 하나로 합쳤고 큰 글씨는 기본 UI 자체가 되었다.
        (고령 사용자를 별도 모드로 분리하지 않는다 — 기본 화면이 이미 그 기준이다)
      */}
      <Route path="/discover" element={<Navigate to="/" replace />} />
      <Route path="/map" element={<Navigate to="/" replace />} />
      <Route path="/easy" element={<Navigate to="/" replace />} />

      {/* ── 관리자 화면 ── */}
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

      {/* 예전 관리자 경로 호환 */}
      <Route path="/regions" element={<Navigate to="/admin/regions" replace />} />
      <Route path="/regions/:regionId" element={<ParamRedirect to={(p) => `/admin/regions/${p.regionId}`} />} />
      <Route path="/inventory" element={<Navigate to="/admin/inventory" replace />} />
      <Route path="/usage" element={<Navigate to="/admin/usage" replace />} />
      <Route path="/welfare-linkage" element={<Navigate to="/admin/welfare-linkage" replace />} />
      <Route path="/files" element={<Navigate to="/admin/files" replace />} />
      <Route path="/files/upload" element={<Navigate to="/admin/files/upload" replace />} />
      <Route path="/files/:submissionId" element={<ParamRedirect to={(p) => `/admin/files/${p.submissionId}`} />} />
      <Route path="/redistribution" element={<Navigate to="/admin/inventory" replace />} />
      <Route path="/forecast" element={<Navigate to="/admin/inventory" replace />} />
      <Route path="/performance" element={<Navigate to="/admin/usage?tab=records" replace />} />
      <Route path="/support-records" element={<Navigate to="/admin/usage" replace />} />
      <Route path="/upload" element={<Navigate to="/admin/files/upload" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
