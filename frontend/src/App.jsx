import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OfficeProvider, useOffice } from './context/OfficeContext';
import { ToastProvider } from './components/Toast';

import RegisterPage      from './pages/RegisterPage';
import FreeRegisterPage  from './pages/FreeRegisterPage';
import LoginPage         from './pages/LoginPage';
import FreeLoginPage     from './pages/FreeLoginPage';
import AdminLoginPage    from './pages/AdminLoginPage';
import OrderPage         from './pages/OrderPage';
import HistoryPage       from './pages/HistoryPage';
import ProfilePage       from './pages/ProfilePage';
import MemberLayout      from './components/MemberLayout';
import AdminLayout       from './components/AdminLayout';

import {
  Dashboard as AdminDashboard,
  Orders    as AdminOrders,
  Products  as AdminProducts,
  Members   as AdminMembers,
  Offices   as AdminOffices,
  Billing   as AdminBilling,
  Settings  as AdminSettings,
  PrintPage
} from './pages/admin/index.js';

// 管理者ルートのガード
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || user.role !== 'admin') return <Navigate to="/admin/login" replace />;
  return children;
}

// 会員ルートのガード（事業所スラグ対応）
function MemberRoute({ children }) {
  const { user, loading } = useAuth();
  const { slug } = useParams();
  const path = window.location.pathname;

  if (loading) return null;

  if (!user || user.role !== 'member') {

    // ★ ここ追加（最重要）
    if (path.startsWith("/free")) {
      return <Navigate to="/free/login" replace />;
    }

    const savedSlug = localStorage.getItem('office_slug');
    const officeSlug = slug || savedSlug;

    if (officeSlug === 'free') {
      return <Navigate to="/free/login" replace />;
    }

    if (officeSlug) {
      return <Navigate to={`/o/${officeSlug}/login`} replace />;
    }

    return <Navigate to="/login" replace />;
  }

  return children;
}

// フリー会員スコープ（マニフェスト注入）
function FreeScope() {
  useEffect(() => {
    const manifest = {
      name: "弁当注文 フリー会員",
      short_name: "free",
      start_url: "/free",
      scope: "/free",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#ffffff"
    };

    const blob = new Blob([JSON.stringify(manifest)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);

    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }

    link.href = url;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, []);

  return <Outlet />;
}

function OfficeScope() {
  const { slug } = useParams();

  useEffect(() => {
    if (!slug) return;

const origin = window.location.origin;

const manifest = {
  name: `弁当注文 ${slug}`,
  short_name: slug,

  start_url: `${origin}/o/${slug}/home`,
  scope: `${origin}/o/${slug}`,

  display: "standalone",
  background_color: "#ffffff",
  theme_color: "#ffffff"
};

    const blob = new Blob([JSON.stringify(manifest)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);

    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }

    link.href = url;

    // cleanup（メモリ解放）
    return () => {
      URL.revokeObjectURL(url);
    };

  }, [slug]);

  return <Outlet />;
}
export default function App() {
  return (
    <AuthProvider>
      <OfficeProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* 管理者 */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                <Route index              element={<AdminDashboard />} />
                <Route path="orders"     element={<AdminOrders />} />
                <Route path="products"   element={<AdminProducts />} />
                <Route path="members"    element={<AdminMembers />} />
                <Route path="offices"    element={<AdminOffices />} />
                <Route path="billing"    element={<AdminBilling />} />
                <Route path="settings"   element={<AdminSettings />} />
                <Route path="print"      element={<PrintPage />} />
              </Route>

              {/* フリー会員 */}
              <Route path="/free/register" element={<FreeRegisterPage />} />
              <Route path="/free/login"    element={<FreeLoginPage />} />
              <Route path="/free" element={<FreeScope />}>
                <Route element={<MemberRoute><MemberLayout /></MemberRoute>}>
                  <Route path="home"    element={<OrderPage />} />
                  <Route path="history" element={<HistoryPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                </Route>
                <Route index element={<Navigate to="/free/home" replace />} />
              </Route>

              {/* 事業所会員（/o/:slug/ スコープ） */}
              <Route path="/o/:slug" element={<OfficeScope />}>
                <Route path="register" element={<RegisterPage />} />
                <Route path="login"    element={<LoginPage />} />
                <Route element={<MemberRoute><MemberLayout /></MemberRoute>}>
                  <Route path="home"    element={<OrderPage />} />
                  <Route path="history" element={<HistoryPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                </Route>
                <Route index element={<SlugHomeRedirect />} />
              </Route>

              {/* 汎用ログイン（PWAホーム起動時のフォールバック） */}
              <Route path="/login"    element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* ルートアクセス → savedSlug から適切な画面へ */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </OfficeProvider>
    </AuthProvider>
  );
}

// /o/:slug/ → /o/:slug/home
function SlugHomeRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/o/${slug}/home`} replace />;
}

function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) return null;

  const savedSlug = localStorage.getItem('office_slug');

  // ★① URLにslugがある場合は絶対優先（最重要）
  const pathParts = window.location.pathname.split('/');
  const urlSlug = pathParts[2];

  if (urlSlug) {
    return <Navigate to={`/o/${urlSlug}/home`} replace />;
  }

  // ★② 保存されているslug
  if (savedSlug && savedSlug !== 'free') {
    return <Navigate to={`/o/${savedSlug}/login`} replace />;
  }

  // ★③ free
  if (savedSlug === 'free') {
    return <Navigate to="/free/login" replace />;
  }

  // ★④ fallback
  return <Navigate to="/free/login" replace />;
}
