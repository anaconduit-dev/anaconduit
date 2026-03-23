import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from 'react-hot-toast';
import { useConfirm } from "../context/ConfirmContext";
import { 
  RefreshCcw, 
  Play, 
  ShieldCheck,
  Globe,
  ExternalLink,
  Zap,
  Lock,
  Loader2
} from "lucide-react";

import { startNginx, restartNginx, applyNginx, getNginxLogs } from "../api/nginx";
import LogTerminal from "../components/LogTerminal";

interface ContextType {
  nginxStatus: any; 
  refreshStatus: () => Promise<void>;
}

export default function SettNginx() {
  const { nginxStatus, refreshStatus } = useOutletContext<ContextType>();
  const { t } = useTranslation();
  const confirm = useConfirm();
  
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const runAction = async (
    actionName: string, 
    actionFn: () => Promise<any>, 
    confirmKey?: string
  ) => {
    if (confirmKey) {
      const isConfirmed = await confirm({
        title: t(`settNginx.${actionName}`),
        message: t(`settNginx.${confirmKey}`),
        type: actionName === 'restart' ? 'danger' : 'info',
        confirmText: t("common.confirm"),
        cancelText: t("common.cancel")
      });
      if (!isConfirmed) return;
    }
    
    setLoadingAction(actionName);

    toast.promise(actionFn(), {
      loading: `${actionName}...`,
      success: () => {
        setTimeout(() => refreshStatus(), 1500);
        setLoadingAction(null);
        return t("settNginx.actionSuccess", { actionName: t(`settNginx.${actionName}`) });
      },
      error: () => {
        setLoadingAction(null);
        return t("settNginx.actionError", { actionName: t(`settNginx.${actionName}`) });
      }
    });
  };

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-900/20">
                <Globe size={22} />
              </div>
              <h1 className="text-3xl font-black text-base tracking-tighter uppercase italic">
                Nginx Gateway<span className="text-emerald-500">.</span>
              </h1>
            </div>
            <p className="text-muted text-[10px] font-black uppercase tracking-[0.2em] ml-1">
              {t("settNginx.info")}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-main border border-line rounded-[2.5rem] overflow-hidden shadow-sm">
              <div className="p-6 border-b border-line bg-card/30 flex justify-between items-center">
                <div className="flex items-center gap-3 text-base font-black uppercase text-[10px] tracking-widest text-muted">
                  <ShieldCheck size={16} className="text-emerald-500" />
                  {t("settNginx.status")}
                </div>
                <div className={`text-[9px] font-black px-3 py-1.5 rounded-xl border tracking-[0.1em] ${
                  nginxStatus.status === 'running' 
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                }`}>
                  {nginxStatus.status ? nginxStatus.status.toUpperCase() : 'UNKNOWN'}
                </div>
              </div>
              
              <div className="p-10">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {/* Start */}
                  <button
                    onClick={() => runAction('run', startNginx)}
                    disabled={!!loadingAction || nginxStatus.status === 'running'}
                    className="group flex flex-col items-center gap-4 p-8 rounded-[2rem] bg-card border border-line hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all disabled:opacity-30 active:scale-95 shadow-xl"
                  >
                    <div className={`p-4 rounded-2xl ${nginxStatus.status !== 'running' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-900/40" : "bg-main text-muted"}`}>
                      {loadingAction === 'run' ? <Loader2 className="animate-spin" size={24} /> : <Play size={24} fill="currentColor" />}
                    </div>
                    <span className="font-black text-[10px] text-base uppercase tracking-widest group-hover:text-emerald-500 transition-colors">{t("settNginx.run")}</span>
                  </button>

                  {/* Apply */}
                  <button
                    onClick={() => runAction('apply', applyNginx, "confirmApply")}
                    disabled={!!loadingAction || nginxStatus.status !== 'running'}
                    className="group flex flex-col items-center gap-4 p-8 rounded-[2rem] bg-card border border-line hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all disabled:opacity-30 active:scale-95 shadow-xl"
                  >
                    <div className={`p-4 rounded-2xl ${nginxStatus.status === 'running' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-900/40" : "bg-main text-muted"}`}>
                      {loadingAction === 'apply' ? <Loader2 className="animate-spin" size={24} /> : <Zap size={24} fill="currentColor" />}
                    </div>
                    <span className="font-black text-[10px] text-base uppercase tracking-widest group-hover:text-indigo-500 transition-colors">{t("settNginx.apply")}</span>
                  </button>

                  {/* Restart */}
                  <button
                    onClick={() => runAction('restart', restartNginx, "confirmRestart")}
                    disabled={!!loadingAction}
                    className="group flex flex-col items-center gap-4 p-8 rounded-[2rem] bg-card border border-line hover:border-blue-500/50 hover:bg-blue-500/5 transition-all disabled:opacity-30 active:scale-95 shadow-xl"
                  >
                    <div className="p-4 rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-900/40">
                      <RefreshCcw size={24} className={loadingAction === 'restart' ? 'animate-spin' : ''} />
                    </div>
                    <span className="font-black text-[10px] text-base uppercase tracking-widest group-hover:text-blue-500 transition-colors">{t("settNginx.restart")}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[2.5rem] overflow-hidden border border-line shadow-2xl">
              <LogTerminal title="Nginx Access & Error Logs" fetchFn={getNginxLogs} />
            </div>
          </div>

          <div className="space-y-6 shrink-0">
            <div className="bg-card/50 border border-line rounded-[2.5rem] p-8 space-y-6">
              <h3 className="font-black text-base text-[10px] uppercase tracking-[0.2em] mb-4 flex items-center gap-3 text-muted">
                <ExternalLink size={16} className="text-indigo-500" />
                {t("settNginx.entryPoints")}
              </h3>
              <div className="space-y-4">
                <a href="/" target="_blank" className="flex items-center justify-between p-5 rounded-[1.5rem] bg-main border border-line hover:border-indigo-500/50 hover:shadow-lg transition-all group active:scale-95">
                  <span className="text-[10px] font-black text-base uppercase tracking-widest">{t("settNginx.mainHttp")}</span>
                  <ExternalLink size={14} className="text-muted group-hover:text-indigo-500 transition-colors" />
                </a>
                
                <div className="relative p-5 rounded-[1.5rem] bg-main/50 border border-line overflow-hidden group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">SSL (HTTPS)</span>
                    <Lock size={14} className="text-muted/30" />
                  </div>
                  <div className="text-[8px] text-amber-500/80 font-black uppercase italic tracking-[0.2em] animate-pulse">
                    Auto-SSL Coming Soon
                  </div>
                  <div className="absolute inset-0 bg-main/40 backdrop-blur-[1px] pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="bg-[#0c0c0e] rounded-[2.5rem] p-8 text-white overflow-hidden relative min-h-[160px] flex flex-col justify-end border border-white/5 shadow-2xl">
              <div className="relative z-10">
                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-2">{t("settNginx.engineVersion")}</p>
                  <p className="text-2xl font-mono font-black text-white tracking-tighter">
                     {nginxStatus.version || 'nginx:stable'}
                  </p>
              </div>
              <Globe className="absolute -right-10 -top-10 text-white/[0.03] rotate-12" size={200} />
            </div>
          </div> 
        </div> 
      </div> 
    </div> 
  );
}