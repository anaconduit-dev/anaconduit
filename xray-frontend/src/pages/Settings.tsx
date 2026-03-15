import { useState } from 'react';
import { Edit3, Globe, Lock, ShieldCheck, BellOff, Database } from 'lucide-react';
import LandingEditor from '../components/LandingEditor';
import AdminCredentialsForm from '../components/AdminCredentialsForm'; // Наш новый компонент
import Modal from '../components/Modal';

const SettingsPage = () => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto space-y-10">
        
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-3xl font-black text-base tracking-tighter uppercase italic">
            Конфигурация<span className="text-indigo-500">.</span>
          </h1>
          <p className="text-muted text-[10px] font-black uppercase tracking-[0.2em] ml-1">
            Внешний вид и параметры безопасности Anaconduit
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6">
          {/* Карточка: Landing Page */}
          <section className="bg-main border border-line rounded-[2.5rem] p-8 flex flex-col md:flex-row items-start md:items-center justify-between group hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-300 gap-6">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-indigo-500/10 rounded-[1.5rem] text-indigo-500 group-hover:scale-110 transition-transform shadow-inner">
                <Globe size={32} />
              </div>
              <div>
                <h3 className="text-base font-black text-lg uppercase tracking-tight">Landing Page</h3>
                <p className="text-muted text-xs font-bold mt-1">Редактирование файлов заглушки (HTML, CSS)</p>
              </div>
            </div>
            
            <button 
              onClick={() => setIsEditorOpen(true)}
              className="w-full md:w-auto flex items-center justify-center gap-3 bg-card border border-line hover:border-indigo-500/50 hover:text-indigo-500 text-muted px-8 py-4 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-xl"
            >
              <Edit3 size={18} />
              Редактировать
            </button>
          </section>

          {/* Карточка: Безопасность (Админ) */}
          <section className="bg-main border border-line rounded-[2.5rem] p-8 flex flex-col md:flex-row items-start md:items-center justify-between group hover:border-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/5 transition-all duration-300 gap-6">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-emerald-500/10 rounded-[1.5rem] text-emerald-500 group-hover:scale-110 transition-transform shadow-inner">
                <Lock size={32} />
              </div>
              <div>
                <h3 className="text-base font-black text-lg uppercase tracking-tight">Admin Credentials</h3>
                <p className="text-muted text-xs font-bold mt-1">Смена логина и пароля для входа в панель</p>
              </div>
            </div>
            
            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full md:w-auto flex items-center justify-center gap-3 bg-card border border-line hover:border-emerald-500/50 hover:text-emerald-500 text-muted px-8 py-4 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-xl"
            >
              <ShieldCheck size={18} />
              Изменить данные
            </button>
          </section>
        </div>

        {/* Прочие настройки (Плейсхолдеры) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card/20 border-2 border-dashed border-line rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center group">
              <div className="w-12 h-12 rounded-2xl bg-line/50 flex items-center justify-center text-muted/30 mb-4 group-hover:scale-110 transition-transform">
                <BellOff size={24} />
              </div>
              <span className="text-[10px] font-black text-muted/40 uppercase tracking-[0.3em]">
                Telegram Notifications <br/>
                <span className="text-indigo-500/40">(Coming Soon)</span>
              </span>
          </div>

          <div className="bg-card/20 border-2 border-dashed border-line rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center group">
              <div className="w-12 h-12 rounded-2xl bg-line/50 flex items-center justify-center text-muted/30 mb-4 group-hover:scale-110 transition-transform">
                <Database size={24} />
              </div>
              <span className="text-[10px] font-black text-muted/40 uppercase tracking-[0.3em]">
                Database Backups <br/>
                <span className="text-indigo-500/40">(Coming Soon)</span>
              </span>
          </div>
        </div>

        {/* Модалки */}
        <Modal 
          isOpen={isEditorOpen} 
          onClose={() => setIsEditorOpen(false)} 
          title="LANDING EDITOR"
        >
          <div className="p-1 overflow-hidden h-[70vh]">
            <LandingEditor />
          </div>
        </Modal>

        <Modal 
          isOpen={isAuthModalOpen} 
          onClose={() => setIsAuthModalOpen(false)} 
          title="SECURITY CONFIG"
        >
          <div className="max-w-md mx-auto py-8 px-4">
            <AdminCredentialsForm onSuccess={() => setIsAuthModalOpen(false)} />
          </div>
        </Modal>

      </div>
    </div>
  );
};

export default SettingsPage;