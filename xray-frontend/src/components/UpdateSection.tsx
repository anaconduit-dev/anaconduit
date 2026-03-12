import { useState } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { triggerUpdate } from '../api/app';

interface UpdateProps {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
}

export const UpdateSection: React.FC<UpdateProps> = ({ currentVersion, latestVersion, hasUpdate }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleUpdate = async () => {
    if (!window.confirm(`Вы уверены, что хотите обновить Anaconduit с ${currentVersion} до ${latestVersion}?`)) {
      return;
    }

    setStatus('loading');
    try {
      // Передаем тег с префиксом 'v', как ожидает Git
      await triggerUpdate(`v${latestVersion}`);
      setStatus('success');
      
      // Через 15 секунд перезагружаем страницу
      setTimeout(() => {
        window.location.reload();
      }, 15000);
    } catch (err: any) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  if (!hasUpdate && status !== 'success') return null;

  return (
    <div className="p-4 mt-4 border border-orange-500/30 bg-orange-500/5 rounded-xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <RefreshCw className={`w-5 h-5 text-orange-500 ${status === 'loading' ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Доступно обновление</h4>
            <p className="text-xs text-gray-400">Новая версия: <span className="text-orange-400 font-mono">{latestVersion}</span></p>
          </div>
        </div>

        <button
          onClick={handleUpdate}
          disabled={status === 'loading' || status === 'success'}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
            status === 'success' 
              ? 'bg-green-600 text-white' 
              : 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/20'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {status === 'loading' ? 'Обновляюсь...' : status === 'success' ? 'Готово!' : 'Установить'}
        </button>
      </div>

      {status === 'success' && (
        <p className="mt-3 text-xs text-green-400 flex items-center gap-1 italic">
          <CheckCircle2 className="w-3 h-3" /> 
          Сервер перезагружается. Панель станет доступна через ~15 секунд.
        </p>
      )}

      {status === 'error' && (
        <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> {errorMsg}
        </p>
      )}
    </div>
  );
};