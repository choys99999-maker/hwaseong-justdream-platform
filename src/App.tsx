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

// 관리자 화면
import TodayPage from './pages/admin/TodayPage';
import SiteOperationsPage from './pages/admin/SiteOperationsPage';
import IntakePage from './pages/admin/IntakePage';
import RegionDetailPage from './pages/RegionDetailPage';
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
        <Route path="/admin" element={<TodayPage />} />

        {/*
          거점 관리. 거점 상세는 별도 페이지가 아니라 같은 화면의 오른쪽 패널이다 —
          주소만 `/admin/sites/:siteId` 로 남겨 링크·뒤로가기가 그대로 동작한다.
        */}
        <Route path="/admin/sites" element={<SiteOperationsPage />} />
        <Route path="/admin/sites/inventory" element={<SiteOperationsPage />} />
        <Route path="/admin/sites/:siteId" element={<SiteOperationsPage />} />
        <Route path="/admin/quick-status" element={<QuickSiteStatusPage />} />
        <Route path="/admin/regions/:regionId" element={<RegionDetailPage />} />

        {/* 시민 요청 */}
        <Route path="/admin/intake" element={<IntakePage />} />
        <Route path="/admin/help-requests/new" element={<PhoneHelpRequestPage />} />

        {/*
          자료 보관함. 사이드바에서 내렸고 화면 안에서 링크하지 않는다 —
          Excel 은 [거점 관리 > 재고 업데이트 > Excel 업로드]가 유일한 입구다.
          예전에 올린 제출본을 주소로 되짚을 수 있도록 경로만 남긴다.
        */}
        <Route path="/admin/files" element={<DataLibraryPage />} />
        <Route path="/admin/files/upload" element={<DataUploadPage />} />
        <Route path="/admin/files/:submissionId" element={<SubmissionDetailPage />} />
      </Route>

      {/* 4개 IA로 정리하기 전 경로 — 흡수된 화면으로 그대로 보낸다. */}
      <Route path="/admin/regions" element={<Navigate to="/admin/sites" replace />} />
      <Route path="/admin/inventory" element={<Navigate to="/admin/sites/inventory" replace />} />
      <Route path="/admin/usage" element={<Navigate to="/admin/intake?tab=usage" replace />} />
      <Route
        path="/admin/welfare-linkage"
        element={<Navigate to="/admin/intake?tab=usage&view=linkage" replace />}
      />

      {/* 루트가 시민 화면으로 바뀌기 전 경로 — 전부 /admin 아래로 옮겼다. */}
      <Route path="/regions" element={<Navigate to="/admin/sites" replace />} />
      <Route path="/regions/:regionId" element={<ParamRedirect to={(p) => `/admin/regions/${p.regionId}`} />} />
      <Route path="/inventory" element={<Navigate to="/admin/sites/inventory" replace />} />
      <Route path="/usage" element={<Navigate to="/admin/intake?tab=usage" replace />} />
      <Route path="/welfare-linkage" element={<Navigate to="/admin/intake?tab=usage&view=linkage" replace />} />
      <Route path="/files" element={<Navigate to="/admin/files" replace />} />
      <Route path="/files/upload" element={<Navigate to="/admin/files/upload" replace />} />
      <Route path="/files/:submissionId" element={<ParamRedirect to={(p) => `/admin/files/${p.submissionId}`} />} />
      {/* 배분·재배분 화면은 제품 정의에서 제외했다 — 가장 가까운 화면(재고)으로 보낸다. */}
      <Route path="/redistribution" element={<Navigate to="/admin/sites/inventory" replace />} />
      <Route path="/forecast" element={<Navigate to="/admin/sites/inventory" replace />} />
      <Route path="/performance" element={<Navigate to="/admin/files?tab=analysis" replace />} />
      <Route path="/support-records" element={<Navigate to="/admin/intake?tab=usage" replace />} />
      <Route path="/upload" element={<Navigate to="/admin/files/upload" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
