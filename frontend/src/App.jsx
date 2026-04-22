import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import RegisterPage   from './pages/RegisterPage';
import LoginPage      from './pages/LoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import OrderPage      from './pages/OrderPage';
import HistoryPage    from './pages/HistoryPage';
import ProfilePage    from './pages/ProfilePage';
import { Dashboard as AdminDashboard, Orders as AdminOrders, Products as AdminProducts, Members as AdminMembers, Offices as AdminOffices, Billing as AdminBilling, Settings as AdminSettings, PrintPage } from './pages/admin/index.js';
import MemberLayout   from './components/MemberLayout';
import AdminLayout    from './components/AdminLayout';

function PrivateRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 公開ルート */}
          <Route path="/o/:slug/register" element={<RegisterPage />} />
          <Route path="/o/:slug/login"    element={<LoginPage />} />
          <Route path="/login"            element={<LoginPage />} />
          <Route path="/admin/login"      element={<AdminLoginPage />} />

          {/* 会員ルート */}
          <Route path="/" element={<PrivateRoute role="member"><MemberLayout /></PrivateRoute>}>
            <Route index          element={<OrderPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* 管理者ルート */}
          <Route path="/admin" element={<PrivateRoute role="admin"><AdminLayout /></PrivateRoute>}>
            <Route index              element={<AdminDashboard />} />
            <Route path="orders"      element={<AdminOrders />} />
            <Route path="products"    element={<AdminProducts />} />
            <Route path="members"     element={<AdminMembers />} />
            <Route path="offices"     element={<AdminOffices />} />
            <Route path="billing"     element={<AdminBilling />} />
            <Route path="settings"    element={<AdminSettings />} />
            <Route path="print"       element={<PrintPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
