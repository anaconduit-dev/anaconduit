import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Edit3, Globe, Lock, ShieldCheck, 
  BellOff, Database, Archive, RefreshCw, Settings2
} from 'lucide-react';
import LandingEditor from '../components/LandingEditor';
import AdminCredentialsForm from '../components/AdminCredentialsForm';
import Modal from '../components/Modal';
import BackupModal from '../components/BackupModal';
import ResourceModal from '../components/ResourceModal'; 
import SystemSettingsModal from '../components/SystemSettingsModal';

const SettingsPage = () => {
  const { t } = useTranslation();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [isSystemModalOpen, setIsSystemModalOpen] = useState(false);

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto space-y-10">
        
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-3xl font-black text-base tracking-tighter uppercase italic">
            {t("settings.title")}<span className="text-indigo-500">.</span>
          </h1>
          <p className="text-muted text-[10px] font-black uppercase tracking-[0.2em] ml-1">
            {t("settings.subtitle")}
          </p>
        </header>

        <div className="grid grid-cols-2 gap-6">
          {/* КАРТОЧКА: Системные настройки (NEW) */}
          <section className="bg-main border border-line rounded-[2.5rem] p-8 flex flex-col md:flex-row items-start md:items-center justify-between group hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-500 gap-6">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-indigo-500/10 rounded-[2rem] text-indigo-500 group-hover:scale-110 transition-transform shadow-inner border border-indigo-500/10">
                <Settings2 size={32} />
              </div>
              <div>
                <h3 className="text-base font-black text-lg uppercase tracking-tight italic">
                  {t("settings.systemTitle")}
                </h3>
                <p className="text-muted text-[10px] font-bold uppercase tracking-wider mt-1 opacity-70">
                  {t("settings.systemDesc")}
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => setIsSystemModalOpen(true)}
              className="w-full md:w-auto flex items-center justify-center gap-3 bg-card border border-line hover:border-indigo-500/50 hover:text-indigo-500 text-muted px-8 py-4 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-xl group/btn"
            >
              <Settings2 size={18} className="group-hover/btn:rotate-90 transition-transform duration-500" />
              {t("settings.configure")}
            </button>
          </section>
          {/* Карточка: Landing Page */}
          <section className="bg-main border border-line rounded-[2.5rem] p-8 flex flex-col md:flex-row items-start md:items-center justify-between group hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-500 gap-6">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-indigo-500/10 rounded-[2rem] text-indigo-500 group-hover:scale-110 transition-transform shadow-inner border border-indigo-500/10">
                <Globe size={32} />
              </div>
              <div>
                <h3 className="text-base font-black text-lg uppercase tracking-tight italic">
                  {t("settings.landingTitle")}
                </h3>
                <p className="text-muted text-[10px] font-bold uppercase tracking-wider mt-1 opacity-70">
                  {t("settings.landingDesc")}
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => setIsEditorOpen(true)}
              className="w-full md:w-auto flex items-center justify-center gap-3 bg-card border border-line hover:border-indigo-500/50 hover:text-indigo-500 text-muted px-8 py-4 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-xl group/btn"
            >
              <Edit3 size={18} className="group-hover/btn:rotate-12 transition-transform" />
              {t("settings.edit")}
            </button>
          </section>

          {/* Карточка: Безопасность */}
          <section className="bg-main border border-line rounded-[2.5rem] p-8 flex flex-col md:flex-row items-start md:items-center justify-between group hover:border-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/5 transition-all duration-500 gap-6">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-amber-500/10 rounded-[2rem] text-amber-500 group-hover:scale-110 transition-transform shadow-inner border border-amber-500/10">
                <Lock size={32} />
              </div>
              <div>
                <h3 className="text-base font-black text-lg uppercase tracking-tight italic">
                  {t("settings.adminTitle")}
                </h3>
                <p className="text-muted text-[10px] font-bold uppercase tracking-wider mt-1 opacity-70">
                  {t("settings.adminDesc")}
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full md:w-auto flex items-center justify-center gap-3 bg-card border border-line hover:border-amber-500/50 hover:text-amber-500 text-muted px-8 py-4 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-xl"
            >
              <ShieldCheck size={18} />
              {t("settings.changeData")}
            </button>
          </section>

          {/* КАРТОЧКА: Гео-ресурсы (NEW) */}
          <section className="bg-main border border-line rounded-[2.5rem] p-8 flex flex-col md:flex-row items-start md:items-center justify-between group hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/5 transition-all duration-500 gap-6">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-emerald-500/10 rounded-[2rem] text-emerald-500 group-hover:scale-110 transition-transform shadow-inner border border-emerald-500/10">
                <RefreshCw size={32} />
              </div>
              <div>
                <h3 className="text-base font-black text-lg uppercase tracking-tight italic">
                  {t("system.geoResources")}
                </h3>
                <p className="text-muted text-[10px] font-bold uppercase tracking-wider mt-1 opacity-70">
                  {t("settings.geoDesc") || "Управление базами GeoIP и GeoSite для маршрутизации"}
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => setIsResourceModalOpen(true)}
              className="w-full md:w-auto flex items-center justify-center gap-3 bg-card border border-line hover:border-emerald-500/50 hover:text-emerald-500 text-muted px-8 py-4 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-xl group/btn"
            >
              <Globe size={18} className="group-hover/btn:animate-pulse transition-transform" />
              {t("settings.manage")}
            </button>
          </section>

          {/* Карточка: Резервные копии */}
          <section className="bg-main border border-line rounded-[2.5rem] p-8 flex flex-col md:flex-row items-start md:items-center justify-between group hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/5 transition-all duration-500 gap-6">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-blue-500/10 rounded-[2rem] text-blue-500 group-hover:scale-110 transition-transform shadow-inner border border-blue-500/10">
                <Database size={32} />
              </div>
              <div>
                <h3 className="text-base font-black text-lg uppercase tracking-tight italic">
                  {t("settings.backups")}
                </h3>
                <p className="text-muted text-[10px] font-bold uppercase tracking-wider mt-1 opacity-70">
                  {t("settings.backupsDesc")}
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => setIsBackupModalOpen(true)}
              className="w-full md:w-auto flex items-center justify-center gap-3 bg-card border border-line hover:border-blue-500/50 hover:text-blue-500 text-muted px-8 py-4 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-xl group/btn"
            >
              <Archive size={18} className="group-hover/btn:-translate-y-1 transition-transform" />
              {t("settings.manage")}
            </button>
          </section>
        </div>

        {/* Плейсхолдеры */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card/20 border-2 border-dashed border-line rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center group grayscale hover:grayscale-0 transition-all duration-500">
              <div className="w-12 h-12 rounded-2xl bg-line/50 flex items-center justify-center text-muted/30 mb-4 group-hover:scale-110 transition-transform">
                <BellOff size={24} />
              </div>
              <span className="text-[10px] font-black text-muted/40 uppercase tracking-[0.3em] group-hover:text-muted transition-colors">
                {t("settings.notifications")} <br/>
                <span className="text-indigo-500/40">{t("settings.comingSoon")}</span>
              </span>
          </div>
        </div>

        {/* Модалки */}
        <Modal 
          isOpen={isEditorOpen} 
          onClose={() => setIsEditorOpen(false)} 
          title={t("settings.landingEditor")}
        >
          <div className="p-1 overflow-hidden h-[70vh]">
            <LandingEditor />
          </div>
        </Modal>

        <Modal 
          isOpen={isAuthModalOpen} 
          onClose={() => setIsAuthModalOpen(false)} 
          title={t("settings.securityConfig")}
        >
          <div className="max-w-md mx-auto py-8 px-4">
            <AdminCredentialsForm onSuccess={() => setIsAuthModalOpen(false)} />
          </div>
        </Modal>

        {/* Модалка ресурсов */}
        <ResourceModal 
          isOpen={isResourceModalOpen} 
          onClose={() => setIsResourceModalOpen(false)} 
        />

        {/* Модалка бэкапов */}
        <BackupModal 
          isOpen={isBackupModalOpen} 
          onClose={() => setIsBackupModalOpen(false)} 
        />
        <SystemSettingsModal 
          isOpen={isSystemModalOpen} 
          onClose={() => setIsSystemModalOpen(false)} 
        />

      </div>
    </div>
  );
};

export default SettingsPage;