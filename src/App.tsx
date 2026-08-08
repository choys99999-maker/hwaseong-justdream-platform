import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './components/layout/AdminLayout';
import DashboardPage from './pages/DashboardPage';
import RegionListPage from './pages/RegionListPage';
import RegionDetailPage from './pages/RegionDetailPage';
import PerformancePage from './pages/PerformancePage';
import InventoryPage from './pages/InventoryPage';
import ForecastPage from './pages/ForecastPage';
import DataUploadPage from './pages/DataUploadPage';
import SupportRecordsPage from './pages/SupportRecordsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/regions" element={<RegionListPage />} />
        <Route path="/regions/:regionId" element={<RegionDetailPage />} />
        <Route path="/performance" element={<PerformancePage />} />
        <Route path="/support-records" element={<SupportRecordsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/forecast" element={<ForecastPage />} />
        <Route path="/upload" element={<DataUploadPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
