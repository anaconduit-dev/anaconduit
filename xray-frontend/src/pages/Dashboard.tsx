import { 
  Users, 
  BarChart3, 
  Activity 
  // Добавим иконку часов
} from "lucide-react";
import { useOutletContext } from "react-router-dom";
// Импортируем тип для контекста, если нужно
import type { DockerListResponse } from "../api/docker";

export default function Dashboard() {
  // Извлекаем dockerData из контекста Layout
  const { xrayStatus, dockerData } = useOutletContext<{ 
    xrayStatus: any; 
    dockerData: DockerListResponse | null 
  }>();

  const stats = [
    { name: "Клиенты Xray", value: "24", sub: "+3 сегодня", icon: <Users size={20}/>, color: "bg-blue-500" },
    { name: "Трафик", value: "1.2 TB", sub: "За 30 дней", icon: <BarChart3 size={20}/>, color: "bg-emerald-500" },
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
    // НОВАЯ КАРТОЧКА: ЗАГРУЗКА СЕРВЕРА
    { 
      name: "Загрузка проекта", 
      value: `${dockerData?.total.cpu_percent || 0}%`, 
      sub: "Среднее CPU", 
      icon: <BarChart3 size={20}/>, 
      color: (dockerData?.total.cpu_percent || 0) > 80 ? "bg-red-500" : "bg-purple-500",
      customContent: (
        <div className="mt-2 pt-2 border-t border-slate-100 space-y-3">
          {/* Мини-бар для CPU */}
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
          
          {/* Данные по RAM */}
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
  ];

  return (
    <div className="p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 italic">Anaconduit!</h1>
          <p className="text-slate-500">Система работает на ядре Xray-core {xrayStatus.version}</p>
        </header>

        {/* Карточки статистики */}
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
              
              {/* Рендерим доп. контент (список аптаймов), если он есть */}
              {s.customContent && s.customContent}
            </div>
          ))}
        </div>

        {/* Секция событий (без изменений) */}
        {/* ... */}
      </div>
    </div>
  );
}