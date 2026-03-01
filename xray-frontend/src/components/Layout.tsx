import { useState, useEffect, useCallback } from "react";
import { logout } from "../store/auth";
import { useNavigate, Outlet, Link, useLocation } from "react-router-dom";
// Импортируем новую функцию и типы
import { getDockerContainers, type DockerListResponse } from "../api/docker";
import { getNginxStatus, type NginxStatus} from "../api/nginx";
import { 
  Users, Activity, Settings, LogOut, Globe, ShieldCheck, RefreshCw, Cpu, HardDrive 
} from "lucide-react";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Храним весь ответ от сервера для статистики
  const [dockerData, setDockerData] = useState<DockerListResponse | null>(null);
  
  // Выделяем конкретно Xray для обратной совместимости с твоим кодом
  const [xrayStatus, setXrayStatus] = useState({
    status: "loading",
    version: "",
    cpu: 0,
    mem: 0
  });
  
  const [nginxStatus, setNginxStatus] = useState<NginxStatus>({
    container: "nginx",
    status: "loading",
    version: ""
  });

  const refreshStatus = useCallback(async () => {
    try {
      // Запускаем оба запроса параллельно для скорости
      const [dockerData, nginxData] = await Promise.all([
        getDockerContainers(),
        getNginxStatus()
      ]);

      setDockerData(dockerData);
      
      // 2. Обновляем состояние Nginx
      setNginxStatus(nginxData);

      // Ищем именно xray в списке контейнеров
      const xray = dockerData.containers.find(c => c.name === "anaconduit_xray");
      
      if (xray) {
        setXrayStatus({
          status: xray.status,
          version: "v" + (xray.image[0]?.split(':').pop() || "latest"),
          cpu: xray.cpu_percent,
          mem: xray.memory.percent
        });
      } else {
        setXrayStatus(prev => ({ ...prev, status: "not_found" }));
      }
    } catch (error) {
      console.error("Status Sync Error:", error);
      setXrayStatus(prev => ({ ...prev, status: "error" }));
      // 3. Обработка ошибки для Nginx
      setNginxStatus(prev => ({ ...prev, status: "error" }));
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 10000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-[#f8fafc]">
      {/* SIDEBAR */}
      <aside className="hidden lg:flex w-64 bg-slate-900 flex-col text-slate-300 border-r border-slate-800">
        <div className="p-6 flex items-center gap-3 text-white">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <Globe size={20} strokeWidth={3} />
          </div>
          <span className="font-bold tracking-wider text-lg">Anaconduit</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 mt-4">
          {[
            { name: "Главная", path: "/dashboard", icon: <Activity size={18} /> },
            { name: "Конфиг Xray", path: "/settxray", icon: <ShieldCheck size={18} /> },
            { name: "Пользователи", path: "/users", icon: <Users size={18} /> },
            { name: "Подключения", path: "/inbounds", icon: <Users size={18} /> },
            { name: "Nginx", path: "/nginx", icon: <Settings size={18} /> },
            { name: "Настройки", path: "/settings", icon: <Settings size={18} /> },
          ].map((item) => (
            <Link
              key={item.path}
              to={item.path}
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

        {/* Новая мини-статистика в сайдбаре */}
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

        <div className="p-4 px-6 text-[10px] text-slate-500 border-t border-slate-800">
          <p className="uppercase tracking-widest font-bold">Ядро Xray</p>
          <p className="mt-1 text-slate-400 font-mono tracking-tighter">{xrayStatus.version || "---"}</p>
          <p className="uppercase tracking-widest font-bold">Nginx</p>
          <p className="mt-1 text-slate-400 font-mono tracking-tighter">{nginxStatus.version || "---"}</p>
        </div>

        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
            <LogOut size={18} /> Выйти
          </button>
        </div>
      </aside>

      {/* ОСНОВНОЙ КОНТЕНТ */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <h2 className="font-semibold text-slate-700">Панель управления</h2>

          <div className="flex items-center gap-4">
            {/* Детальный статус Xray */}
            <div className={`flex items-center gap-3 px-3 py-1.5 rounded-full border transition-all ${
              xrayStatus.status === 'running' 
              ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
              : "bg-red-50 text-red-700 border-red-100"
            }`}>
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase">
                <div className={`w-2 h-2 rounded-full ${
                  xrayStatus.status === 'running' ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                }`} />
                {xrayStatus.status === 'running' ? 'Xray Online' : 'Xray Offline'}
              </div>
              
              {/* Добавим нагрузку самого xray в хедер */}
              {xrayStatus.status === 'running' && (
                <div className="flex gap-2 pl-2 border-l border-emerald-200 text-[9px] font-bold opacity-70">
                  <span>CPU: {xrayStatus.cpu}%</span>
                  <span>MEM: {xrayStatus.mem}%</span>
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
          {/* Передаем расширенный статус и все данные через context */}
          <Outlet context={{ xrayStatus, nginxStatus, dockerData, refreshStatus }} /> 
        </main>
      </div>
    </div>
  );
}