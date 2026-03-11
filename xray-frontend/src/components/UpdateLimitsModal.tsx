import { useState, useEffect } from "react";
import { X, ShieldAlert, Zap, Calendar, Save, Loader2, Plus } from "lucide-react";
import { updateLimits } from "../api/user";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: any;
}

export default function UpdateLimitsModal({ isOpen, onClose, onSuccess, user }: Props) {
  const [traffic, setTraffic] = useState<string>("");
  const [days, setDays] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      // Конвертируем байты из БД обратно в GB для отображения
      const currentLimitGb = user.traffic_limit 
        ? Math.floor(user.traffic_limit / (1024 ** 3)) 
        : "";
      setTraffic(currentLimitGb.toString());
      setDays(""); // Срок жизни всегда вводим "плюсом", поэтому обнуляем
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      // Если поле пустое — отправляем null, чтобы API понимал, что менять не нужно
      const trafficVal = traffic === "" ? null : parseInt(traffic);
      const daysVal = days === "" ? null : parseInt(days);
      
      await updateLimits(user.id, trafficVal, daysVal);
      onSuccess();
      onClose();
    } catch (e) {
      alert("Ошибка при обновлении лимитов");
    } finally {
      setLoading(false);
    }
  };

  // Вспомогательная функция для быстрых кнопок
  const addDays = (d: number) => {
    const current = parseInt(days) || 0;
    setDays((current + d).toString());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                 <h2 className="text-2xl font-black text-slate-900 leading-tight">Лимиты</h2>
                 {user.is_active ? 
                    <span className="bg-emerald-100 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full font-bold">ACTIVE</span> :
                    <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">EXPIRED</span>
                 }
              </div>
              <p className="text-slate-500 font-medium text-sm">{user.email}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
              <X size={24} />
            </button>
          </div>

          <div className="space-y-6">
            {/* Трафик */}
            <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Zap size={14} className="text-indigo-500" /> Общий лимит (GB)
            </label>
            <div className="relative">
                <input 
                type="number" 
                value={traffic}
                onChange={(e) => setTraffic(e.target.value)}
                placeholder="0 = Безлимит"
                /* Увеличиваем pr-14, чтобы текст GB и стрелки не мешали цифрам */
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-4 pr-16 py-4 font-mono font-bold text-lg focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs select-none pointer-events-none bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm">
                GB
                </div>
            </div>
            </div>

            {/* Продление времени */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Calendar size={14} className="text-indigo-500" /> Продлить на (дней)
              </label>
              <input 
                type="number" 
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="0 = Сбросить срок"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-mono font-bold text-lg focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              />
              
              {/* Быстрые пресеты */}
              <div className="flex gap-2">
                {[30, 90, 365].map(d => (
                  <button 
                    key={d}
                    onClick={() => addDays(d)}
                    className="flex-1 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-1"
                  >
                    <Plus size={10} /> {d}Д
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3">
              <ShieldAlert className="text-amber-500 shrink-0" size={20} />
              <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                Если пользователь был заблокирован, сохранение корректных лимитов **автоматически разблокирует** его в Xray.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-200 transition-all uppercase text-xs"
          >
            Отмена
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="flex-1 bg-slate-900 hover:bg-black text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-200 disabled:opacity-50 uppercase text-xs"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Применить
          </button>
        </div>
      </div>
    </div>
  );
}