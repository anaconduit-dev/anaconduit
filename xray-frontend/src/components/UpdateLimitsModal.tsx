import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next"; // Импорт
import { X, ShieldAlert, Zap, Calendar, Save, Loader2, Plus } from "lucide-react";
import { Switch } from "../components/ui/Switch";
import { toast } from "react-hot-toast";
import { updateLimits } from "../api/user";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: any;
}

export default function UpdateLimitsModal({ isOpen, onClose, onSuccess, user }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    traffic: "",
    days: "",
    auto_reset_traffic: false,
    reset_period: "month"
  });

  useEffect(() => {
    if (user && isOpen) {
      const currentLimitGb = user.traffic_limit 
        ? Math.floor(user.traffic_limit / (1024 ** 3)) 
        : "";
      
      setFormData({
        traffic: currentLimitGb.toString(),
        days: "",
        auto_reset_traffic: user.auto_reset_traffic || false,
        reset_period: user.reset_period || "month"
      });
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      const trafficVal = formData.traffic === "" ? null : parseInt(formData.traffic);
      const daysVal = formData.days === "" ? null : parseInt(formData.days);
      
      // Отправляем расширенный объект данных в API
      await updateLimits(user.id, {
        traffic_limit: trafficVal,
        add_days: daysVal,
        auto_reset_traffic: formData.auto_reset_traffic,
        reset_period: formData.reset_period
      });
      
      toast.success(t("modals.limits.successUpdate"));
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(t("modals.limits.errorUpdate"));
    } finally {
      setLoading(false);
    }
  };

  // Вспомогательная функция для быстрых кнопок
  const addDays = (d: number) => {
    const current = parseInt(formData.days) || 0;
    setFormData(prev => ({ ...prev, days: (current + d).toString() }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-main/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-main w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-line animate-in zoom-in-95 duration-200">
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-black text-base leading-none uppercase tracking-tight">
                  {t("modals.limits.title")}
                </h2>
                <span className={`text-[9px] px-2 py-1 rounded-lg font-black border ${
                  user.is_active 
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]" 
                  : "bg-red-500/10 text-red-500 border-red-500/20"
                }`}>
                  {user.is_active ? t("status.active") : t("status.expired")}
                </span>
              </div>
              <p className="text-muted font-bold text-xs mt-2 italic">{user.email}</p>
            </div>
            <button 
              onClick={onClose} 
              className="p-2.5 hover:bg-card rounded-2xl transition-all text-muted hover:text-base active:scale-90"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-8">
            {/* Трафик */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted flex items-center gap-2 ml-1">
                <Zap size={14} className="text-indigo-500" /> {t("modals.limits.trafficLabel")}
              </label>
              <div className="relative group">
                <input 
                  type="number" 
                  value={formData.traffic} // Было value={traffic}
                  onChange={(e) => setFormData(prev => ({ ...prev, traffic: e.target.value }))} // Было setTraffic
                  placeholder={t("modals.limits.unlimited")}
                  className="w-full bg-card border border-line rounded-2xl pl-5 pr-16 py-4 font-mono font-bold text-lg text-base focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted font-black text-[10px] select-none pointer-events-none bg-main border border-line px-2.5 py-1.5 rounded-xl shadow-sm group-focus-within:border-indigo-500/30 transition-colors">
                  GB
                </div>
              </div>
            </div>
            <div className="space-y-4 p-6 bg-main/20 rounded-[2rem] border border-line">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-muted">
                  {t("modals.limits.autoTrafficReset")}
                </span>
                <Switch 
                  checked={formData.auto_reset_traffic}
                  onChange={(val) => setFormData({...formData, auto_reset_traffic: val})}
                />
              </div>

              {formData.auto_reset_traffic && (
                <div className="grid grid-cols-3 gap-2">
                  {['day', 'week', 'month'].map((period) => (
                    <button
                      key={period}
                      onClick={() => setFormData({...formData, reset_period: period})}
                      className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-tighter transition-all ${
                        formData.reset_period === period 
                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                        : 'bg-card text-muted hover:text-white'
                      }`}
                    >
                      {t(`periods.${period}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Продление времени */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted flex items-center gap-2 ml-1">
                <Calendar size={14} className="text-indigo-500" /> {t("modals.limits.daysLabel")}
              </label>
              <input 
                type="number" 
                value={formData.days} // Было value={days}
                onChange={(e) => setFormData(prev => ({ ...prev, days: e.target.value }))} // Было setDays
                placeholder={t("modals.limits.daysPlaceholder")}
                className="w-full bg-card border border-line rounded-2xl px-5 py-4 font-mono font-bold text-lg text-base focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"
              />
              
              {/* Быстрые пресеты */}
              <div className="flex gap-2">
                {[30, 90, 365].map(d => (
                  <button 
                    key={d}
                    onClick={() => addDays(d)}
                    className="flex-1 py-2.5 bg-card border border-line rounded-xl text-[10px] font-black text-muted hover:border-indigo-500/50 hover:text-indigo-500 hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-1 active:scale-95"
                  >
                    <Plus size={10} /> {t("modals.limits.daysPreset", { count: d })}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/10 p-5 rounded-[2rem] flex gap-4">
              <ShieldAlert className="text-amber-500 shrink-0" size={20} />
              <p className="text-[10px] text-amber-500/80 font-bold leading-relaxed uppercase tracking-tight">
                {t("modals.limits.warningInfo")}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-card/30 border-t border-line flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-6 py-4 rounded-2xl font-black text-muted hover:text-base transition-all uppercase text-[10px] tracking-widest"
          >
            {t("modals.limits.cancel")}
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className={`flex-1 px-6 py-4 rounded-3xl font-black flex items-center justify-center gap-3 transition-all uppercase text-[10px] tracking-widest shadow-xl active:scale-[0.98]
              ${loading 
                ? 'bg-main text-muted cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20'}`}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {t("modals.limits.apply")}
          </button>
        </div>
      </div>
    </div>
  );
}