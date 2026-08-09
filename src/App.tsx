import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './components/layout/AdminLayout';
import DashboardPage from './pages/DashboardPage';
import RegionListPage from './pages/RegionListPage';
import RegionDetailPage from './pages/RegionDetailPage';
import UsageSupportPage from './pages/UsageSupportPage';
import InventoryPage from './pages/InventoryPage';
import RedistributionPage from './pages/RedistributionPage';
import DataLibraryPage from './pages/DataLibraryPage';
import DataUploadPage from './pages/DataUploadPage';
import SubmissionDetailPage from './pages/SubmissionDetailPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/redistribution" element={<RedistributionPage />} />
        <Route path="/usage" element={<UsageSupportPage />} />
        <Route path="/regions" element={<RegionListPage />} />
        <Route path="/regions/:regionId" element={<RegionDetailPage />} />
        <Route path="/files" element={<DataLibraryPage />} />
        <Route path="/files/upload" element={<DataUploadPage />} />
        <Route path="/files/:submissionId" element={<SubmissionDetailPage />} />
        {/* 예전 메뉴 경로 호환 — 통합·개편된 화면으로 보낸다. */}
        <Route path="/forecast" element={<Navigate to="/redistribution" replace />} />
        <Route path="/performance" element={<Navigate to="/usage?tab=records" replace />} />
        <Route path="/support-records" element={<Navigate to="/usage" replace />} />
        <Route path="/upload" element={<Navigate to="/files/upload" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
