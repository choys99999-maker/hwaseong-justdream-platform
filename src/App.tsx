import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './components/layout/AdminLayout';
import DashboardPage from './pages/DashboardPage';
import RegionListPage from './pages/RegionListPage';
import RegionDetailPage from './pages/RegionDetailPage';
import SupportRecordsPage from './pages/SupportRecordsPage';
import InventoryPage from './pages/InventoryPage';
import DataUploadPage from './pages/DataUploadPage';
import DataLibraryPage from './pages/DataLibraryPage';
import SubmissionDetailPage from './pages/SubmissionDetailPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/regions" element={<RegionListPage />} />
        <Route path="/regions/:regionId" element={<RegionDetailPage />} />
        <Route path="/support-records" element={<SupportRecordsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/files" element={<DataLibraryPage />} />
        <Route path="/files/upload" element={<DataUploadPage />} />
        <Route path="/files/:submissionId" element={<SubmissionDetailPage />} />
        {/* 예전 업로드 경로로 들어오면 자료 관리 안의 업로드 화면으로 보낸다. */}
        <Route path="/upload" element={<Navigate to="/files/upload" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
