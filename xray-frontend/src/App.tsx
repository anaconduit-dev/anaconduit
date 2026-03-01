import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// ... твои импорты
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import SettXray from "./pages/SettXray";
import Users from "./pages/Users";
import Inbounds from "./pages/Inbounds";
import SettNginx from "./pages/SettNginx";
import SubscriptionPage from "./pages/SubscriptionPage";
import { getToken } from "./store/auth";

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
          <Route path="/nginx" element={<SettNginx />} />
          <Route path="/settings" element={<div>Настройки</div>} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}
