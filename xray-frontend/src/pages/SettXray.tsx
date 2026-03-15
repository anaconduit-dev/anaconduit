import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  RefreshCcw, 
  Play, 
  Square, 
  Power, 
  AlertCircle, 
  CheckCircle2,
  Settings2,
  Download, 
  Loader2,
  Cpu
} from "lucide-react";
import { startXray, stopXray, restartXray, getXrayVersions, installXrayVersion, getXrayLogs } from "../api/xray";
import LogTerminal from "../components/LogTerminal";

interface ContextType {
  xrayStatus: any; 
  refreshStatus: () => Promise<void>;
}

export default function SettXray() {
  const { xrayStatus, refreshStatus } = useOutletContext<ContextType>();
  
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [versions, setVersions] = useState<string[]>([]);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  const loadVersions = useCallback(async () => {
    setIsLoadingVersions(true);
    try {
      const data = await getXrayVersions();
      setVersions(data);
    } catch (e) {
      console.error("Ошибка загрузки версий");
    } finally {
      setIsLoadingVersions(false);
    }
  }, []);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleInstall = async (version: string) => {
    if (version === xrayStatus.version) return;
    const confirmMessage = `Установить версию ${version}? Текущая версия (${xrayStatus.version}) будет заменена.`;
    if (!window.confirm(confirmMessage)) return;

    setIsInstalling(true);
    try {
      await installXrayVersion(version);
      setMessage({ text: `Версия ${version} успешно установлена`, type: "success" });
      setTimeout(() => {
        refreshStatus();
        setIsInstalling(false);
      }, 5000);
    } catch (error) {
      setMessage({ text: "Ошибка при установке версии", type: "error" });
      setIsInstalling(false);
    }
  };

  const runAction = async (actionName: string, actionFn: () => Promise<any>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setLoadingAction(actionName);
    try {
      await actionFn();
      setMessage({ text: `Xray Core: ${actionName} выполнено`, type: "success" });
      setTimeout(() => refreshStatus(), 2000);
    } catch (error) {
      setMessage({ text: `Ошибка: ${actionName}`, type: "error" });
    } finally {
      setLoadingAction(null);
      setTimeout(() => setMessage({ text: "", type: "" }), 5000);
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-900/20">
                <Settings2 size={22} />
              </div>
              <h1 className="text-3xl font-black text-base tracking-tighter uppercase italic">
                Xray Core<span className="text-indigo-500">.</span>
              </h1>
            </div>
            <p className="text-muted text-[10px] font-black uppercase tracking-[0.2em] ml-1">
              Управление жизненным циклом и версиями ядра
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          <div className="lg:col-span-2 space-y-8">
            {/* Статус и управление */}
            <div className="bg-main border border-line rounded-[2.5rem] overflow-hidden shadow-sm">
              <div className="p-6 border-b border-line bg-card/30 flex justify-between items-center">
                <div className="flex items-center gap-3 text-base font-black uppercase text-[10px] tracking-widest">
                  <Power size={16} className="text-indigo-500" />
                  Контроль службы
                </div>
                <div className={`text-[9px] font-black px-3 py-1.5 rounded-xl border tracking-[0.1em] ${
                  xrayStatus.status === 'running' 
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                  : 'bg-red-500/10 text-red-500 border-red-500/20'
                }`}>
                  {xrayStatus.status ? xrayStatus.status.toUpperCase() : 'UNKNOWN'}
                </div>
              </div>
              
              <div className="p-10">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <button
                    onClick={() => runAction('start', startXray)}
                    disabled={!!loadingAction || xrayStatus.status === 'running'}
                    className="group flex flex-col items-center gap-4 p-8 rounded-[2rem] bg-card border border-line hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all disabled:opacity-30 active:scale-95 shadow-xl"
                  >
                    <div className={`p-4 rounded-2xl ${xrayStatus.status !== 'running' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-900/40" : "bg-main text-muted"}`}>
                      <Play size={24} fill="currentColor" />
                    </div>
                    <span className="font-black text-[10px] text-base uppercase tracking-widest group-hover:text-emerald-500 transition-colors">Запуск</span>
                  </button>

                  <button
                    onClick={() => runAction('stop', stopXray, "Остановить Xray?")}
                    disabled={!!loadingAction || xrayStatus.status !== 'running'}
                    className="group flex flex-col items-center gap-4 p-8 rounded-[2rem] bg-card border border-line hover:border-red-500/50 hover:bg-red-500/5 transition-all disabled:opacity-30 active:scale-95 shadow-xl"
                  >
                    <div className={`p-4 rounded-2xl ${xrayStatus.status === 'running' ? "bg-red-500 text-white shadow-lg shadow-red-900/40" : "bg-main text-muted"}`}>
                      <Square size={24} fill="currentColor" />
                    </div>
                    <span className="font-black text-[10px] text-base uppercase tracking-widest group-hover:text-red-500 transition-colors">Стоп</span>
                  </button>

                  <button
                    onClick={() => runAction('restart', restartXray, "Перезапустить ядро?")}
                    disabled={!!loadingAction}
                    className="group flex flex-col items-center gap-4 p-8 rounded-[2rem] bg-card border border-line hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all disabled:opacity-30 active:scale-95 shadow-xl"
                  >
                    <div className="p-4 rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-900/40">
                      <RefreshCcw size={24} className={loadingAction === 'restart' ? 'animate-spin' : ''} />
                    </div>
                    <span className="font-black text-[10px] text-base uppercase tracking-widest group-hover:text-indigo-500 transition-colors">Рестарт</span>
                  </button>
                </div>

                {message.text && (
                  <div className={`mt-10 p-5 rounded-[1.5rem] border flex items-center gap-4 text-xs font-bold uppercase tracking-tight animate-in slide-in-from-top-4 ${
                    message.type === 'success' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : 'bg-red-500/5 border-red-500/20 text-red-500'
                  }`}>
                    {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    {message.text}
                  </div>
                )}
              </div>
            </div>

            {/* Активная версия виджет */}
            <div className="bg-[#0c0c0e] border border-white/5 rounded-[2.5rem] p-8 flex items-center justify-between shadow-2xl relative overflow-hidden">
              <div className="flex items-center gap-6 relative z-10">
                <div className="p-5 bg-indigo-500/10 rounded-[1.5rem] text-indigo-500 border border-indigo-500/20 shadow-inner">
                  <Cpu size={32} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-1">Active Binary Version</p>
                  <p className="text-3xl font-mono font-black text-white tracking-tighter">{xrayStatus.version}</p>
                </div>
              </div>
              {isInstalling && (
                <div className="flex items-center gap-3 text-indigo-400 font-black text-[10px] uppercase tracking-widest animate-pulse relative z-10">
                  <Loader2 size={18} className="animate-spin" /> INSTALLING...
                </div>
              )}
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Cpu size={120} />
              </div>
            </div>

            <div className="rounded-[2.5rem] overflow-hidden border border-line shadow-2xl">
              <LogTerminal title="Xray Access & Error Logs" fetchFn={getXrayLogs} />
            </div>
          </div>

          {/* ПРАВАЯ КОЛОНКА: Версии */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-card/50 border border-line rounded-[2.5rem] overflow-hidden flex flex-col h-[650px] shadow-sm">
              <div className="p-6 border-b border-line bg-card/30 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <Download size={18} className="text-indigo-500" />
                  <h3 className="text-[10px] font-black text-base uppercase tracking-widest">Версии Ядра</h3>
                </div>
                <button 
                  onClick={loadVersions}
                  disabled={isLoadingVersions || isInstalling}
                  className="p-2 hover:bg-main rounded-xl text-muted hover:text-indigo-500 transition-all active:scale-90"
                >
                  <RefreshCcw size={16} className={isLoadingVersions ? "animate-spin" : ""} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
                {isLoadingVersions ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted gap-4">
                    <Loader2 size={32} className="animate-spin text-indigo-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Синхронизация с GitHub...</span>
                  </div>
                ) : (
                  versions.map((v) => {
                    const isCurrent = v === xrayStatus.version;
                    return (
                      <button
                        key={v}
                        disabled={isInstalling || isCurrent} 
                        onClick={() => handleInstall(v)}
                        className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all text-left group relative overflow-hidden ${
                          isCurrent 
                          ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-500 cursor-default' 
                          : 'bg-main border-line text-muted hover:border-indigo-500/50 hover:text-base active:scale-[0.98]'
                        } ${isInstalling && !isCurrent ? 'opacity-30 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex flex-col relative z-10">
                          <span className={`text-sm font-mono font-black ${isCurrent ? 'text-indigo-400' : 'text-base'}`}>
                            {v}
                          </span>
                          {isCurrent && (
                            <span className="text-[8px] font-black uppercase tracking-tighter mt-1 flex items-center gap-1 opacity-70">
                              <CheckCircle2 size={10} /> Active Now
                            </span>
                          )}
                        </div>
                        
                        {!isCurrent && (
                          <div className="w-10 h-10 rounded-xl bg-card border border-line flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all relative z-10 shadow-sm">
                            <Download size={16} />
                          </div>
                        )}
                        {/* Тонкий индикатор текущей версии */}
                        {isCurrent && <div className="absolute inset-y-0 left-0 w-1 bg-indigo-500" />}
                      </button>
                    );
                  })
                )}
              </div>
              
              <div className="p-6 bg-card/30 border-t border-line text-[9px] text-muted text-center font-black uppercase tracking-[0.3em]">
                GITHUB RELEASES API
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}