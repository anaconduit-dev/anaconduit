import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  RefreshCcw, 
  Play, 
  Square,
  AlertCircle, 
  CheckCircle2,
  ShieldCheck,
  Globe,
  Loader2,
  ExternalLink,
  Zap
} from "lucide-react";
// Предполагаем, что эти функции уже созданы в api/nginx.ts
import { startNginx, stopNginx, restartNginx, setupNginx } from "../api/nginx";

interface ContextType {
  nginxStatus: any; 
  refreshStatus: () => Promise<void>;
}

export default function SettNginx() {
  const { nginxStatus, refreshStatus } = useOutletContext<ContextType>();
  
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [isSettingUp, setIsSettingUp] = useState(false);

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
      // Даем контейнеру время подняться перед обновлением статуса
      setTimeout(() => refreshStatus(), 2000);
    } catch (error) {
      setMessage({ text: `Ошибка Nginx: ${actionName}`, type: "error" });
    } finally {
      setLoadingAction(null);
      setTimeout(() => setMessage({ text: "", type: "" }), 5000);
    }
  };

  const handleInitialSetup = async () => {
    const confirm = window.confirm("Запустить первичную настройку Nginx? Это создаст базовые конфиги и запустит контейнер.");
    if (!confirm) return;

    setIsSettingUp(true);
    try {
      await setupNginx(false); // false = без SSL для начала
      setMessage({ text: "Nginx успешно настроен и запущен", type: "success" });
      setTimeout(() => {
        refreshStatus();
        setIsSettingUp(false);
      }, 3000);
    } catch (e) {
      setMessage({ text: "Ошибка при установке Nginx", type: "error" });
      setIsSettingUp(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Globe className="text-emerald-600" size={32} />
          Управление Nginx
        </h1>
        <p className="text-slate-500 mt-1">Шлюз для ваших подписок и веб-интерфейса.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* ЛЕВАЯ КОЛОНКА: Управление */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2 text-slate-800 font-bold uppercase text-xs tracking-widest">
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
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all disabled:opacity-30 group"
                >
                  <Play size={24} className={nginxStatus.status !== 'running' ? "text-emerald-500" : "text-slate-300"} fill="currentColor" />
                  <span className="font-bold text-xs uppercase">Запустить</span>
                </button>

                <button
                  onClick={() => runAction('stop', stopNginx, "Остановить веб-сервер?")}
                  disabled={!!loadingAction || nginxStatus.status !== 'running'}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white border border-slate-200 hover:border-red-500 hover:bg-red-50 transition-all disabled:opacity-30"
                >
                  <Square size={24} className={nginxStatus.status === 'running' ? "text-red-500" : "text-slate-300"} fill="currentColor" />
                  <span className="font-bold text-xs uppercase">Остановить</span>
                </button>

                <button
                  onClick={() => runAction('restart', restartNginx, "Перезапустить Nginx?")}
                  disabled={!!loadingAction || nginxStatus.status !== 'running'}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-30"
                >
                  <RefreshCcw size={24} className={`text-blue-500 ${loadingAction === 'restart' ? 'animate-spin' : ''}`} />
                  <span className="font-bold text-xs uppercase">Релоад</span>
                </button>
              </div>

              {message.text && (
                <div className={`mt-8 p-4 rounded-2xl border flex items-center gap-3 text-sm font-medium animate-in fade-in zoom-in-95 ${
                  message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
                }`}>
                  {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  {message.text}
                </div>
              )}
            </div>
          </div>

          {/* Карточка быстрой настройки (если Nginx не найден) */}
          {nginxStatus.status === 'not_found' && (
            <div className="p-8 bg-linear-to-br from-indigo-600 to-violet-700 rounded-3xl text-white shadow-xl">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold mb-2">Первичная настройка</h2>
                  <p className="text-indigo-100 text-sm max-w-md">
                    Контейнер Nginx еще не инициализирован. Мы создадим структуру папок и базовый конфиг для работы панели.
                  </p>
                </div>
                <Zap size={40} className="text-indigo-300 opacity-50" />
              </div>
              <button 
                onClick={handleInitialSetup}
                disabled={isSettingUp}
                className="mt-6 px-8 py-3 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSettingUp ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                УСТАНОВИТЬ СЕЙЧАС
              </button>
            </div>
          )}
        </div>

        {/* ПРАВАЯ КОЛОНКА: Инфо и ссылки */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
              <ExternalLink size={16} className="text-indigo-500" />
              Точки входа
            </h3>
            <div className="space-y-3">
              <a href="/" target="_blank" className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-all group">
                <span className="text-xs font-semibold text-slate-600">Главная (HTTP)</span>
                <ExternalLink size={14} className="text-slate-400 group-hover:text-indigo-500" />
              </a>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 opacity-50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-400">SSL (HTTPS)</span>
                  <ShieldCheck size={14} className="text-slate-300" />
                </div>
                <div className="text-[10px] text-amber-600 font-bold uppercase italic">Не настроено</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-3xl p-6 text-white overflow-hidden relative">
            <div className="relative z-10">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Образ</p>
                <p className="text-lg font-mono font-bold">{nginxStatus.version || 'nginx:mainline'}</p>
            </div>
            <Globe className="absolute -right-4 -bottom-4 text-white/5" size={120} />
          </div>
        </div>

      </div>
    </div>
  );
}