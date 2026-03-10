import { useEffect, useState } from "react";
import { Users, BarChart3, Activity, HardDrive } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { getStats, getStatsSystem } from "../api/stats"; // Импортируем твой новый метод
import type { DockerListResponse } from "../api/docker";

// Утилита для красивого форматирования байт
const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export default function Dashboard() {
  const { xrayStatus, dockerData } = useOutletContext<{ 
    xrayStatus: any; 
    dockerData: DockerListResponse | null 
  }>();

  // Локальное состояние для данных бэкенда
  const [summary, setSummary] = useState<{
    total_clients: number;
    new_today: number;
    total_traffic_bytes: number;
  } | null>(null);

  const [systemStats, setSystemStats] = useState<any>(null);

  useEffect(() => {
    // 1. Загрузка статистики БД
    const fetchDbStats = () => getStats().then(setSummary).catch(console.error);
    
    // 2. Загрузка системных метрик сервера
    const fetchSystemStats = () => getStatsSystem().then(setSystemStats).catch(console.error);

    fetchDbStats();
    fetchSystemStats();

    // Обновляем БД раз в минуту, а систему чуть чаще (например, раз в 15 секунд)
    const dbTimer = setInterval(fetchDbStats, 60000);
    const sysTimer = setInterval(fetchSystemStats, 15000);

    return () => {
      clearInterval(dbTimer);
      clearInterval(sysTimer);
    };
  }, []);

  const stats = [
    { 
      name: "Клиенты Xray", 
      value: summary?.total_clients ?? "...", 
      sub: `+${summary?.new_today ?? 0} сегодня`, 
      icon: <Users size={20}/>, 
      color: "bg-blue-500" 
    },
    { 
      name: "Трафик", 
      value: summary ? formatBytes(summary.total_traffic_bytes) : "...", 
      sub: "", 
      icon: <BarChart3 size={20}/>, 
      color: "bg-emerald-500" 
    },
    { 
      name: "Uptime Системы", 
      value: xrayStatus.status === 'running' ? "ONLINE" : "OFFLINE", 
      sub: "Статус ядра", 
      icon: <Activity size={20}/>, 
      color: xrayStatus.status === 'running' ? "bg-indigo-500" : "bg-red-500",
      customContent: (
        <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
          {dockerData?.containers.map(container => (
            <div key={container.name} className="flex justify-between items-center text-[9px] font-mono">
              <span className="text-slate-500 truncate mr-2">{container.name.replace('anaconduit_', '')}:</span>
              <span className={container.status === 'running' ? "text-indigo-600 font-bold" : "text-red-400"}>
                {container.status === 'running' ? container.uptime : 'offline'}
              </span>
            </div>
          ))}
        </div>
      )
    },
    { 
      name: "Нагрузка проекта", 
      value: `${dockerData?.total.cpu_percent || 0}%`, 
      sub: "Среднее CPU", 
      icon: <BarChart3 size={20}/>, 
      color: (dockerData?.total.cpu_percent || 0) > 80 ? "bg-red-500" : "bg-purple-500",
      customContent: (
        <div className="mt-2 pt-2 border-t border-slate-100 space-y-3">
          <div className="space-y-1">
             <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                <span>Процессор</span>
                <span>{dockerData?.total.cpu_percent}%</span>
             </div>
             <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 transition-all duration-500" 
                  style={{ width: `${Math.min(dockerData?.total.cpu_percent || 0, 100)}%` }}
                />
             </div>
          </div>
          <div className="space-y-1">
             <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                <span>Память ({dockerData?.total.mem_usage_percent}%)</span>
                <span>{dockerData?.total.mem_usage_mb} MB</span>
             </div>
             <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-500" 
                  style={{ width: `${Math.min(dockerData?.total.mem_usage_percent || 0, 100)}%` }}
                />
             </div>
          </div>
        </div>
      )
    },
    { 
      name: "Ресурсы Сервера", 
      value: `${systemStats?.system?.cpu_percent ?? 0}%`, 
      sub: "Load Avg", 
      icon: <HardDrive size={20}/>, 
      color: (systemStats?.system?.cpu_percent > 80) ? "bg-red-600" : "bg-purple-600",
      customContent: (
        <div className="mt-2 pt-2 border-t border-slate-100 space-y-3">
          {/* CPU Сервера */}
          <div className="space-y-1">
             <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                <span>Процессор (Host)</span>
                <span>{systemStats?.system?.cpu_percent}%</span>
             </div>
             <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 transition-all duration-500" 
                  style={{ width: `${systemStats?.system?.cpu_percent || 0}%` }}
                />
             </div>
          </div>
          
          {/* RAM Сервера */}
          <div className="space-y-1">
             <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                <span>Память ({systemStats?.system?.mem_percent}%)</span>
                <span>Сервер</span>
             </div>
             <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-500" 
                  style={{ width: `${systemStats?.system?.mem_percent || 0}%` }}
                />
             </div>
          </div>

          {/* Disk Сервера */}
          <div className="space-y-1">
             <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                <span>Диск ({systemStats?.system?.disk_percent}%)</span>
                <span>Root FS</span>
             </div>
             <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-slate-400 transition-all duration-500" 
                  style={{ width: `${systemStats?.system?.disk_percent || 0}%` }}
                />
             </div>
          </div>
        </div>
      )
    },
  ];

  return (
    <div className="p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 italic">Anaconduit!</h1>
          <p className="text-slate-500">Система работает на ядре Xray-core {xrayStatus.version}</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((s, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
              <div>
                <div className="flex justify-between items-start">
                  <div className={`p-2 rounded-lg ${s.color} text-white`}>
                    {s.icon}
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-slate-500 text-sm font-medium">{s.name}</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900">{s.value}</span>
                    <span className="text-xs text-slate-400 uppercase tracking-wider">{s.sub}</span>
                  </div>
                </div>
              </div>
              {s.customContent && s.customContent}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}