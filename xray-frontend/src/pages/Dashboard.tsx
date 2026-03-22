import { useEffect, useState } from "react";
import { Users, BarChart3, Activity, HardDrive, Cpu, Database } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getStats, getStatsSystem } from "../api/stats";
import type { DockerListResponse } from "../api/docker";

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export default function Dashboard() {
  const { t } = useTranslation();
  const { xrayStatus, dockerData } = useOutletContext<{ 
    xrayStatus: any; 
    dockerData: DockerListResponse | null 
  }>();

  const [summary, setSummary] = useState<{
    total_clients: number;
    new_today: number;
    total_traffic_bytes: number;
  } | null>(null);

  const [systemStats, setSystemStats] = useState<any>(null);

  useEffect(() => {
    const fetchDbStats = () => getStats().then(setSummary).catch(console.error);
    const fetchSystemStats = () => getStatsSystem().then(setSystemStats).catch(console.error);

    fetchDbStats();
    fetchSystemStats();

    const dbTimer = setInterval(fetchDbStats, 60000);
    const sysTimer = setInterval(fetchSystemStats, 15000);

    return () => {
      clearInterval(dbTimer);
      clearInterval(sysTimer);
    };
  }, []);

  const stats = [
    { 
      name: t("dashboard.users"), 
      value: summary?.total_clients ?? "...", 
      sub: `+${summary?.new_today ?? 0} ${t("dashboard.today")}`, 
      icon: <Users size={18}/>, 
      color: "bg-blue-500",
      customContent: (
        <div className="mt-4 pt-4 border-t border-line/50">
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[9px] font-black text-muted uppercase tracking-widest">Active Database</span>
           </div>
        </div>
      )
    },
    { 
      name: t("dashboard.totalTraffic"), 
      value: summary ? formatBytes(summary.total_traffic_bytes) : "...", 
      sub: "", 
      icon: <Database size={18}/>, 
      color: "bg-emerald-500",
      customContent: (
        <div className="mt-4 pt-4 border-t border-line/50">
           <div className="flex items-center gap-2">
              <BarChart3 size={12} className="text-emerald-500" />
              <span className="text-[9px] font-black text-muted uppercase tracking-widest">Global Statistics</span>
           </div>
        </div>
      )
    },
    { 
      name: t("layout.xrayCore"), 
      value: xrayStatus.status === 'running' ? "ONLINE" : "OFFLINE", 
      sub: `${xrayStatus.version || '0.0'}`, 
      icon: <Activity size={18}/>, 
      color: xrayStatus.status === 'running' ? "bg-indigo-500" : "bg-red-500",
      customContent: (
        <div className="mt-4 pt-4 border-t border-line/50 space-y-2">
          {dockerData?.containers.map(container => (
            <div key={container.name} className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-muted/60 truncate mr-2">{container.name.replace('anaconduit_', '')}</span>
              <span className={container.status === 'running' ? "text-indigo-400 font-bold" : "text-red-400"}>
                {container.status === 'running' ? "●" : "○"}
              </span>
            </div>
          ))}
        </div>
      )
    },
    { 
      name: t("dashboard.host"),
      value: `${systemStats?.system?.cpu_percent ?? 0}%`, 
      sub: t("dashboard.cpu"), 
      icon: <Cpu size={18}/>, 
      color: (systemStats?.system?.cpu_percent > 80) ? "bg-red-600" : "bg-purple-500",
      customContent: (
        <div className="mt-4 pt-4 border-t border-line/50 space-y-4">
          <ResourceBar label="CPU" percent={systemStats?.system?.cpu_percent} color="bg-purple-500" />
          <ResourceBar label={`RAM (${systemStats?.system?.mem_percent}%)`} percent={systemStats?.system?.mem_percent} color="bg-indigo-500" />
          <ResourceBar label={`DISK (${systemStats?.system?.disk_percent}%)`} percent={systemStats?.system?.disk_percent} color="bg-slate-400" />
        </div>
      )
    },
  ];

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-base tracking-tighter italic uppercase italic-important">
              {t("dashboard.dashboard")}<span className="text-indigo-500">.</span>
            </h1>
            <p className="text-muted text-xs font-bold uppercase tracking-[0.2em]">
              {t("dashboard.managementPanel")}
            </p>
          </div>
          <div className="px-4 py-2 bg-card border border-line rounded-2xl flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
             <span className="text-[10px] font-black text-base uppercase tracking-widest">
                {t("layout.xrayCore")} <span className="text-indigo-500">{xrayStatus.version}</span>
             </span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <div 
              key={i} 
              className="bg-main p-7 rounded-[2.5rem] border border-line shadow-sm flex flex-col hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 group"
            >
              <div className="flex justify-between items-start">
                <div className={`p-3 rounded-2xl ${s.color} text-white shadow-lg shadow-current/20 group-hover:scale-110 transition-transform`}>
                  {s.icon}
                </div>
              </div>
              <div className="mt-6">
                <h3 className="text-muted text-[10px] font-black uppercase tracking-widest">{s.name}</h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-black text-base tracking-tight">{s.value}</span>
                  <span className="text-[10px] text-muted font-bold uppercase">{s.sub}</span>
                </div>
              </div>
              {s.customContent}
            </div>
          ))}
        </div>

        {/* Секция Docker контейнеров (можно расширить) */}
        <section className="bg-card/30 border border-line rounded-[3rem] p-8">
           <div className="flex items-center gap-3 mb-8">
              <HardDrive className="text-indigo-500" size={20} />
              <h2 className="text-xs font-black text-base uppercase tracking-[0.3em]">{t("dashboard.conteinersStatus")}</h2>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {dockerData?.containers.map(c => (
                <div key={c.name} className="bg-main border border-line p-5 rounded-3xl flex items-center justify-between">
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black text-base uppercase tracking-wider">{c.name.replace('anaconduit_', '')}</span>
                      <span className="text-[9px] text-muted font-bold">{c.uptime}</span>
                   </div>
                   <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${c.status === 'running' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                      {c.status}
                   </div>
                </div>
              ))}
           </div>
        </section>
      </div>
    </div>
  );
}

// Вспомогательный компонент для полосок ресурсов
function ResourceBar({ label, percent, color }: { label: string, percent: number, color: string }) {
  const p = Math.min(percent || 0, 100);
  return (
    <div className="space-y-1.5">
       <div className="flex justify-between text-[9px] font-black text-muted uppercase tracking-tighter">
          <span>{label}</span>
          <span className="text-base">{p}%</span>
       </div>
       <div className="w-full h-1 bg-card border border-line rounded-full overflow-hidden">
          <div 
            className={`h-full ${color} transition-all duration-1000 ease-out`} 
            style={{ width: `${p}%` }}
          />
       </div>
    </div>
  );
}