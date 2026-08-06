import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import AdminLayout from './components/layout/AdminLayout';
import DashboardPage from './pages/DashboardPage';
import RegionListPage from './pages/RegionListPage';
import RegionDetailPage from './pages/RegionDetailPage';
import SupportRecordsPage from './pages/SupportRecordsPage';
import InventoryPage from './pages/InventoryPage';
import DataUploadPage from './pages/DataUploadPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/regions" element={<RegionListPage />} />
          <Route path="/regions/:regionId" element={<RegionDetailPage />} />
          <Route path="/support-records" element={<SupportRecordsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/upload" element={<DataUploadPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
