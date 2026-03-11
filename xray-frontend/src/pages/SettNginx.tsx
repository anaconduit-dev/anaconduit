import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  RefreshCcw, 
  Play, 
  AlertCircle, 
  CheckCircle2,
  ShieldCheck,
  Globe,
  ExternalLink,
  Zap
} from "lucide-react";

// Удалили setupNginx из импортов
import { startNginx, restartNginx, applyNginx, getNginxLogs } from "../api/nginx";
import LogTerminal from "../components/LogTerminal";

interface ContextType {
  nginxStatus: any; 
  refreshStatus: () => Promise<void>;
}

export default function SettNginx() {
  const { nginxStatus, refreshStatus } = useOutletContext<ContextType>();
  
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState({ text: "", type: "" });

  const runAction = async (
    actionName: string, 
    actionFn: () => Promise<any>, 
    confirmText?: string
  ) => {
    if (confirmText && !window.confirm(confirmText)) return;
    
    setLoadingAction(actionName);
    try {
      await actionFn();
      setMessage({ text: `Nginx: ${actionName} выполнен успешно`, type: "success" });
      setTimeout(() => refreshStatus(), 2000);
    } catch (error) {
      setMessage({ text: `Ошибка Nginx: ${actionName}`, type: "error" });
    } finally {
      setLoadingAction(null);
      setTimeout(() => setMessage({ text: "", type: "" }), 5000);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Globe className="text-emerald-600" size={32} />
          Управление Nginx
        </h1>
        <p className="text-slate-500 font-medium">Шлюз для ваших подписок и веб-интерфейса.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* ЛЕВАЯ КОЛОНКА */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2 text-slate-800 font-bold uppercase text-[10px] tracking-widest">
                <ShieldCheck size={16} className="text-slate-400" />
                Статус сервера
              </div>
              <div className={`text-[10px] font-black px-2 py-1 rounded-md border ${
                nginxStatus.status === 'running' 
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                : 'bg-amber-50 text-amber-600 border-amber-100'
              }`}>
                {nginxStatus.status ? nginxStatus.status.toUpperCase() : 'UNKNOWN'}
              </div>
            </div>
            
            <div className="p-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => runAction('start', startNginx)}
                  disabled={!!loadingAction || nginxStatus.status === 'running'}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all disabled:opacity-30"
                >
                  <Play size={24} className={nginxStatus.status !== 'running' ? "text-emerald-500" : "text-slate-300"} fill="currentColor" />
                  <span className="font-bold text-[10px] uppercase tracking-wider">Запустить</span>
                </button>

                <button
                  onClick={() => runAction('apply', applyNginx, "Применить изменения конфигурации?")}
                  disabled={!!loadingAction || nginxStatus.status !== 'running'}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all disabled:opacity-30"
                >
                  <Zap size={24} className={nginxStatus.status === 'running' ? "text-indigo-500" : "text-slate-300"} fill="currentColor" />
                  <span className="font-bold text-[10px] uppercase tracking-wider">Применить</span>
                </button>

                <button
                  onClick={() => runAction('restart', restartNginx, "Перезапустить контейнер?")}
                  disabled={!!loadingAction}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-30"
                >
                  <RefreshCcw size={24} className={`text-blue-500 ${loadingAction === 'restart' ? 'animate-spin' : ''}`} />
                  <span className="font-bold text-[10px] uppercase tracking-wider">Рестарт</span>
                </button>
              </div>

              {message.text && (
                <div className={`mt-8 p-4 rounded-2xl border flex items-center gap-3 text-sm font-medium ${
                  message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
                }`}>
                  {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  {message.text}
                </div>
              )}
            </div>
          </div>

          <LogTerminal 
            title="Nginx Access & Error Logs" 
            fetchFn={getNginxLogs} 
          />
        </div>

        {/* ПРАВАЯ КОЛОНКА */}
        <div className="space-y-6 shrink-0">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
              <ExternalLink size={16} className="text-indigo-500" />
              Точки входа
            </h3>
            <div className="space-y-3">
              <a href="/" target="_blank" className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-white transition-all group">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-tighter">Главная (HTTP)</span>
                <ExternalLink size={14} className="text-slate-400 group-hover:text-indigo-500" />
              </a>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 opacity-50 cursor-not-allowed">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">SSL (HTTPS)</span>
                  <ShieldCheck size={14} className="text-slate-300" />
                </div>
                <div className="text-[10px] text-amber-600 font-black uppercase italic tracking-widest">Auto-SSL Coming Soon</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-3xl p-6 text-white overflow-hidden relative min-h-[140px] flex flex-col justify-end">
            <div className="relative z-10">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Версия Nginx</p>
                <p className="text-xl font-mono font-bold text-indigo-400">{nginxStatus.version || 'nginx:stable'}</p>
            </div>
            <Globe className="absolute -right-6 -top-6 text-white/5" size={160} />
          </div>
        </div>
      </div>
    </div>
  );
}