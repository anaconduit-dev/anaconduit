import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { Loader2, Shield, BarChart3 } from 'lucide-react';
import Modal from './Modal';
import { getGlobalSettings, updateGlobalSettings } from '../api/settings';

interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SystemSettingsModal = ({ isOpen, onClose }: SystemSettingsModalProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Состояние адаптировано под структуру API
  const [settings, setSettings] = useState({
    log_level: 'warning',
    stats_enabled: false,
  });

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await getGlobalSettings();
      setSettings({
        log_level: data.log_level || 'warning',
        // Если хотя бы один тип статистики включен, считаем что "Статистика включена"
        stats_enabled: !!(data.stats_user_uplink || data.stats_user_downlink),
      });
    } catch (e) {
      toast.error(t("common.errorFetch"));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    
    // Формируем payload согласно спецификации эндпоинта
    const payload = {
      log_level: settings.log_level,
      stats_user_uplink: settings.stats_enabled,
      stats_user_downlink: settings.stats_enabled
    };

    try {
      await updateGlobalSettings(payload);
      toast.success(t("common.success"));
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const logLevels = ['debug', 'info', 'warning', 'error', 'none'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("settings.systemConfig")}>
      <div className="p-6 space-y-8 max-w-lg mx-auto">
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
          </div>
        ) : (
          <>
            {/* Настройка Логов */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-indigo-500">
                <Shield size={20} />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-base">
                  {t("settings.logs.title")}
                </h4>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {logLevels.map(level => (
                  <button
                    key={level}
                    onClick={() => setSettings(p => ({ ...p, log_level: level }))}
                    className={`py-2 rounded-xl text-[9px] font-black uppercase transition-all border ${
                      settings.log_level === level 
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' 
                      : 'bg-card border-line text-muted hover:border-indigo-500/50'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-muted font-bold uppercase opacity-50 italic">
                {t("settings.logs.desc")}
              </p>
            </div>

            {/* Настройка Статистики (Объединенная) */}
            <div className="space-y-4 pt-6 border-t border-line">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-emerald-500">
                  <BarChart3 size={20} />
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-base">
                    {t("settings.stats.title")}
                  </h4>
                </div>
                <button
                  onClick={() => setSettings(p => ({ ...p, stats_enabled: !p.stats_enabled }))}
                  className={`w-12 h-6 rounded-full transition-all relative shadow-inner ${
                    settings.stats_enabled ? 'bg-emerald-500' : 'bg-line'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                    settings.stats_enabled ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>
              <p className="text-[9px] text-muted font-bold uppercase opacity-50 italic">
                {t("settings.stats.desc")}
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-900/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : t("common.save")}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
};

export default SystemSettingsModal;