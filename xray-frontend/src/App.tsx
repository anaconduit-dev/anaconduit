import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from 'react-hot-toast';
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import SettXray from "./pages/SettXray";
import Users from "./pages/Users";
import Inbounds from "./pages/Inbounds";
import OutboundsPage from "./pages/OutboundsPage"
import SettNginx from "./pages/SettNginx";
import Settings from "./pages/Settings";
import SubscriptionPage from "./pages/SubscriptionPage";
import SubscriptionTemplates from "./pages/SubscriptionTemplates";
import UserGroups from "./pages/UserGroups";
import { getToken } from "./store/auth";
import './i18n/config'; // Просто импорт для инициализации
import { ConfirmProvider } from "./context/ConfirmContext";
function ProtectedRoute({ children }: any) {
  const token = getToken();
  if (!token) return <Navigate to="/login" />;
  return children;
}

// Расширяем интерфейс конфига
declare global {
  interface Window {
    __PANEL_CONFIG__?: {
      basename: string;
      mode: 'admin' | 'client';
    };
  }
}

export default function App() {
  const config = window.__PANEL_CONFIG__;
  const dynamicBasename = config?.basename || "/";

  // Логика для КЛИЕНТСКОЙ страницы подписки
  if (config?.mode === 'client') {
  return (
    <BrowserRouter basename={dynamicBasename}>
      <Routes>
        {/* :token — это динамический параметр, который React подхватит из URL */}
        <Route path="/:token" element={<SubscriptionPage />} />
        {/* Если зашли просто в корень /jsdfdjjsdh/ */}
        <Route path="/" element={<SubscriptionPage />} />
        {/* Редирект для всего остального */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

  // Логика для АДМИН-ПАНЕЛИ
  return (
    <BrowserRouter basename={dynamicBasename}>
      <ConfirmProvider>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1a1a1a', // Твой bg-card
              color: '#fff',
              borderRadius: '24px',
              border: '1px solid rgba(99, 102, 241, 0.2)', // Твой indigo-500/20
              padding: '16px 24px',
              fontSize: '12px',
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#fff' },
            }
          }} 
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settxray" element={<SettXray />} />
            <Route path="/users" element={<Users />} />
            <Route path="/inbounds" element={<Inbounds />} />
            <Route path="/outbounds" element={<OutboundsPage />} />
            <Route path="/subtemplates" element={<SubscriptionTemplates />} />
            <Route path="/usergroups" element={<UserGroups />} />
            <Route path="/nginx" element={<SettNginx />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </ConfirmProvider>
    </BrowserRouter>
  );
}
