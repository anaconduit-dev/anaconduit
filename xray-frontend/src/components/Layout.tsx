import { useState, useEffect, useCallback } from "react";
import { logout } from "../store/auth";
import { useNavigate, Outlet, Link, useLocation } from "react-router-dom";
import { getDockerContainers, type DockerListResponse } from "../api/docker";
import { getNginxStatus, type NginxStatus} from "../api/nginx";
import { getSystemStatus, getLatestVersion } from "../api/app";
import { UpdateSection } from "../components/UpdateSection";
import { 
  Users, Activity, Settings, LogOut, Globe, ShieldCheck, RefreshCw, Cpu, HardDrive, Menu, X 
} from "lucide-react";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Состояние мобильного меню
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [dockerData, setDockerData] = useState<DockerListResponse | null>(null);
  const [xrayStatus, setXrayStatus] = useState({
    status: "loading",
    version: "",
    cpu: 0,
    mem: 0
  });
  const [systemVersion, setSystemVersion] = useState({
    current: "",
    latest: "",
    hasUpdate: false
  });
  const [nginxStatus, setNginxStatus] = useState<NginxStatus>({
    container: "nginx",
    status: "loading",
    version: ""
  });

  // 1. Быстрый интервал для метрик (2 сек)
const refreshStatus = useCallback(async () => {
  try {
    const [dData, nData, sData] = await Promise.all([
      getDockerContainers(),
      getNginxStatus(),
      getSystemStatus()
    ]);

    setDockerData(dData);
    setNginxStatus(nData);
    
    // Обновляем текущую версию бэкенда (без Гитхаба)
    setSystemVersion(prev => ({
      ...prev,
      current: sData.version
    }));

    const xray = dData.containers.find(c => c.name === "anaconduit_xray");
    if (xray) {
      setXrayStatus({
        status: xray.status,
        version: "v" + (xray.image[0]?.split(':').pop() || "latest"),
        cpu: xray.cpu_percent,
        mem: xray.memory.percent
      });
    }
  } catch (error) {
    console.error("Polling error:", error);
  }
}, []);

// 2. РЕДКАЯ проверка обновлений (только при загрузке)
useEffect(() => {
  const checkGitHub = async () => {
    try {
      const latestRelease = await getLatestVersion();
      
      // Очищаем теги от префикса 'v', чтобы сравнение было честным
      const githubTag = latestRelease.tag_name.replace(/^v/, ''); 
      const localTag = systemVersion.current.replace(/^v/, '');

      console.log("🚀 Чистый тег GitHub:", githubTag);
      console.log("🏠 Чистый тег системы:", localTag);

      setSystemVersion(prev => ({
        ...prev,
        latest: githubTag,
        hasUpdate: localTag !== "" && githubTag !== localTag 
      }));
    } catch (e) {
      console.error("❌ Ошибка при проверке GitHub:", e);
    }
  };

  // Запускаем проверку только когда получили версию от бэкенда
  if (systemVersion.current) {
    checkGitHub();
  }
}, [systemVersion.current]);// Добавляем current в зависимости, чтобы сравнить сразу как он придет

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 2000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Закрытие меню при клике на ссылку (для мобилок)
  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="min-h-screen flex bg-[#f8fafc] relative">
      
      {/* OVERLAY для мобильного меню */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[45] lg:hidden animate-in fade-in duration-300"
          onClick={closeMenu}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-[50] w-64 bg-slate-900 flex flex-col text-slate-300 border-r border-slate-800 transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="p-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Globe size={20} strokeWidth={3} />
            </div>
            <span className="font-bold tracking-wider text-lg">Anaconduit</span>
          </div>
          {/* Кнопка закрытия внутри сайдбара для мобилок */}
          <button onClick={closeMenu} className="lg:hidden p-1 text-slate-400">
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
          {[
            { name: "Главная", path: "/dashboard", icon: <Activity size={18} /> },
            { name: "Конфиг Xray", path: "/settxray", icon: <ShieldCheck size={18} /> },
            { name: "Подключения", path: "/inbounds", icon: <Users size={18} /> },
            { name: "Пользователи", path: "/users", icon: <Users size={18} /> },
            { name: "Nginx", path: "/nginx", icon: <Settings size={18} /> },
            { name: "Настройки", path: "/settings", icon: <Settings size={18} /> },
          ].map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={closeMenu}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                location.pathname === item.path 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {item.icon} {item.name}
            </Link>
          ))}
        </nav>
        {/* --- НОВАЯ СЕКЦИЯ ОБНОВЛЕНИЯ --- */}
        <div className="px-4 pb-2">
            <UpdateSection 
                currentVersion={systemVersion.current}
                latestVersion={systemVersion.latest}
                hasUpdate={systemVersion.hasUpdate}
            />
        </div>
        {/* Мини-статистика в сайдбаре */}
        {dockerData && (
          <div className="px-6 py-4 space-y-3 border-t border-slate-800/50">
             <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500">
                <span>Проект нагрузки</span>
                <span className="text-indigo-400">{dockerData.total.count} CTR</span>
             </div>
             <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                   <div className="flex items-center gap-2"><Cpu size={12}/> CPU</div>
                   <span className={dockerData.total.cpu_percent > 80 ? "text-red-400" : "text-slate-300"}>
                     {dockerData.total.cpu_percent}%
                   </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                   <div className="flex items-center gap-2"><HardDrive size={12}/> RAM</div>
                   <span>{dockerData.total.mem_usage_mb} MB</span>
                </div>
             </div>
          </div>
        )}

        <div className="p-4 px-6 text-[10px] text-slate-500 border-t border-slate-800 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="uppercase tracking-widest font-bold text-indigo-400">Anaconduit</p>
              <p className="mt-1 text-slate-300 font-mono tracking-tighter">
                {systemVersion.current || "v1.0.01"}
              </p>
            </div>
            {systemVersion.hasUpdate && (
              <div className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full animate-pulse border border-amber-500/20">
                <RefreshCw size={8} />
                <span className="font-bold">UPDATE</span>
              </div>
            )}
          </div>

          <p className="mt-3 uppercase tracking-widest font-bold">Ядро Xray</p>
          <p className="mt-1 text-slate-400 font-mono tracking-tighter">{xrayStatus.version || "---"}</p>
          
          <p className="mt-2 uppercase tracking-widest font-bold">Nginx</p>
          <p className="text-slate-400 font-mono tracking-tighter">{nginxStatus.version || "---"}</p>
        </div>

        <div className="p-4 border-t border-slate-800 shrink-0">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
            <LogOut size={18} /> Выйти
          </button>
        </div>
      </aside>

      {/* ОСНОВНОЙ КОНТЕНТ */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40 shrink-0">
          <div className="flex items-center gap-3">
            {/* Бургер-кнопка для мобилок */}
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              <Menu size={24} />
            </button>
            <h2 className="font-bold text-slate-700 truncate max-w-[150px] lg:max-w-none">
              Панель управления
            </h2>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            {/* Статус Xray */}
            <div className={`flex items-center gap-2 lg:gap-3 px-2 lg:px-3 py-1.5 rounded-full border transition-all ${
              xrayStatus.status === 'running' 
              ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
              : "bg-red-50 text-red-700 border-red-100"
            }`}>
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                xrayStatus.status === 'running' ? "bg-emerald-500 animate-pulse" : "bg-red-500"
              }`} />
              
              <span className="text-[9px] lg:text-[10px] font-black uppercase whitespace-nowrap">
                {xrayStatus.status === 'running' ? 'Online' : 'Offline'}
              </span>
              
              {/* Нагрузка (скрываем на совсем маленьких экранах) */}
              {xrayStatus.status === 'running' && (
                <div className="hidden sm:flex gap-2 pl-2 border-l border-emerald-200 text-[9px] font-bold opacity-70 whitespace-nowrap">
                  <span>CPU: {xrayStatus.cpu}%</span>
                </div>
              )}
            </div>
            
            <button 
              onClick={refreshStatus} 
              className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-8">
            <Outlet context={{ xrayStatus, nginxStatus, dockerData, refreshStatus }} /> 
          </div>
        </main>
      </div>
    </div>
  );
}