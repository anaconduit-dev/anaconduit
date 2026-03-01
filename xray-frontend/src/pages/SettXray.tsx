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
import { startXray, stopXray, restartXray, getXrayVersions, installXrayVersion } from "../api/xray";

interface ContextType {
  xrayStatus: any; 
  dockerData: any; 
  refreshStatus: () => Promise<void>;
}

export default function SettXray() {
  const { xrayStatus, refreshStatus } = useOutletContext<ContextType>();
  
  // ИСПРАВЛЕНИЕ 1: Добавляем типы <string | null>, чтобы можно было записывать название экшена
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

  const runAction = async (
    actionName: string, 
    actionFn: () => Promise<any>, 
    confirmText?: string // Сделали опциональным
  ) => {
    // ИСПРАВЛЕНИЕ 2: Проверка confirmText на существование
    if (confirmText && !window.confirm(confirmText)) return;
    
    setLoadingAction(actionName);
    try {
      await actionFn();
      setMessage({ text: `Команда ${actionName} выполнена`, type: "success" });
      setTimeout(() => refreshStatus(), 2000);
    } catch (error) {
      setMessage({ text: `Ошибка: ${actionName}`, type: "error" });
    } finally {
      setLoadingAction(null);
      setTimeout(() => setMessage({ text: "", type: "" }), 5000);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Settings2 className="text-indigo-600" size={32} />
          Настройки Xray
        </h1>
        <p className="text-slate-500 mt-1">Управление жизненным циклом и версиями Xray Core.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2 text-slate-800 font-bold uppercase text-xs tracking-widest">
                <Power size={16} className="text-slate-400" />
                Контроль контейнера
              </div>
              <div className={`text-[10px] font-black px-2 py-1 rounded-md border ${
                xrayStatus.status === 'running' 
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                : 'bg-red-50 text-red-600 border-red-100'
              }`}>
                {xrayStatus.status.toUpperCase()}
              </div>
            </div>
            
            <div className="p-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  // ИСПРАВЛЕНИЕ 3: Передаем пустую строку вместо отсутствия аргумента
                  onClick={() => runAction('start', startXray, "")}
                  disabled={!!loadingAction || xrayStatus.status === 'running'}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all disabled:opacity-30"
                >
                  <Play size={24} className={xrayStatus.status !== 'running' ? "text-emerald-500" : ""} fill="currentColor" />
                  <span className="font-bold text-xs uppercase">Запуск</span>
                </button>

                <button
                  onClick={() => runAction('stop', stopXray, "Остановить сервер?")}
                  disabled={!!loadingAction || xrayStatus.status !== 'running'}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white border border-slate-200 hover:border-red-500 hover:bg-red-50 transition-all disabled:opacity-30"
                >
                  <Square size={24} className={xrayStatus.status === 'running' ? "text-red-500" : ""} fill="currentColor" />
                  <span className="font-bold text-xs uppercase">Стоп</span>
                </button>

                <button
                  onClick={() => runAction('restart', restartXray, "Перезагрузить Xray?")}
                  disabled={!!loadingAction}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all disabled:opacity-30"
                >
                  <RefreshCcw size={24} className={`text-indigo-500 ${loadingAction === 'restart' ? 'animate-spin' : ''}`} />
                  <span className="font-bold text-xs uppercase">Рестарт</span>
                </button>
              </div>

              {message.text && (
                <div className={`mt-8 p-4 rounded-2xl border flex items-center gap-3 text-sm font-medium animate-in slide-in-from-bottom-2 ${
                  message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
                }`}>
                  {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  {message.text}
                </div>
              )}
            </div>
          </div>

          <div className="p-6 bg-slate-900 rounded-3xl text-white flex items-center justify-between shadow-xl shadow-indigo-900/10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30 text-indigo-400">
                <Cpu size={24} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-[0.2em]">Active Core</p>
                <p className="text-xl font-mono font-bold tracking-tighter">{xrayStatus.version}</p>
              </div>
            </div>
            {isInstalling && (
               <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs animate-pulse">
                 <Loader2 size={16} className="animate-spin" /> УСТАНОВКА...
               </div>
            )}
          </div>
        </div>

        {/* ПРАВАЯ КОЛОНКА: Версии */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[520px]">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Download size={18} className="text-indigo-500" />
                <h3 className="font-bold text-slate-800 text-sm">Версии ядра</h3>
              </div>
              <button 
                onClick={loadVersions}
                disabled={isLoadingVersions || isInstalling}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-30"
                title="Обновить список"
              >
                <RefreshCcw size={16} className={isLoadingVersions ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {isLoadingVersions ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                  <Loader2 size={24} className="animate-spin" />
                  <span className="text-xs font-medium uppercase">Загрузка...</span>
                </div>
              ) : (
                versions.map((v) => {
                  const isCurrent = v === xrayStatus.version;
                  return (
                    <button
                      key={v}
                      // Блокируем кнопку, если идет установка ИЛИ если эта версия уже установлена
                      disabled={isInstalling || isCurrent} 
                      onClick={() => handleInstall(v)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left group ${
                        isCurrent 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 cursor-default' // Стиль для текущей версии
                        : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50 active:scale-[0.98]'
                      } ${isInstalling && !isCurrent ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex flex-col">
                        <span className={`text-sm font-mono font-bold ${isCurrent ? 'text-indigo-900' : 'text-slate-700'}`}>
                          {v}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter mt-0.5 flex items-center gap-1">
                            <CheckCircle2 size={10} strokeWidth={3} /> Активно сейчас
                          </span>
                        )}
                      </div>
                      
                      {!isCurrent && (
                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all">
                          <Download size={14} />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-center font-bold">
              GITHUB RELEASES
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}