import { useState } from 'react';
import { Edit3, Globe, Lock, ShieldCheck } from 'lucide-react';
import LandingEditor from '../components/LandingEditor';
import AdminCredentialsForm from '../components/AdminCredentialsForm'; // Наш новый компонент
import Modal from '../components/Modal';

const SettingsPage = () => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Настройки системы</h1>
        <p className="text-slate-400 text-sm">Управление внешним видом и параметрами безопасности сервера</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Карточка: Landing Page */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between group hover:border-slate-700 transition-all shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 group-hover:scale-110 transition-transform">
              <Globe size={28} />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">Landing Page</h3>
              <p className="text-slate-400 text-sm font-light">Редактирование файлов заглушки (HTML, CSS)</p>
            </div>
          </div>
          
          <button 
            onClick={() => setIsEditorOpen(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl transition-all font-medium active:scale-95 shadow-lg shadow-black/20"
          >
            <Edit3 size={18} />
            Редактировать
          </button>
        </section>

        {/* Карточка: Безопасность (Админ) */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center justify-between group hover:border-slate-700 transition-all shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform">
              <Lock size={28} />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">Доступ администратора</h3>
              <p className="text-slate-400 text-sm font-light">Смена логина и пароля для входа в панель</p>
            </div>
          </div>
          
          <button 
            onClick={() => setIsAuthModalOpen(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl transition-all font-medium active:scale-95 shadow-lg shadow-black/20"
          >
            <ShieldCheck size={18} />
            Изменить данные
          </button>
        </section>
      </div>

      {/* Модалка: Редактор файлов */}
      <Modal 
        isOpen={isEditorOpen} 
        onClose={() => setIsEditorOpen(false)} 
        title="Редактор файлов заглушки"
      >
        <LandingEditor />
      </Modal>

      {/* Модалка: Смена учетных данных */}
      <Modal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        title="Безопасность администратора"
      >
        <div className="max-w-md mx-auto">
          <AdminCredentialsForm onSuccess={() => setIsAuthModalOpen(false)} />
        </div>
      </Modal>

      {/* Прочие настройки (заглушки) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-40">
         <div className="border border-dashed border-slate-800 rounded-2xl p-6 text-slate-600 text-center text-sm">
            Уведомления Telegram (Скоро)
         </div>
         <div className="border border-dashed border-slate-800 rounded-2xl p-6 text-slate-600 text-center text-sm">
            Резервное копирование БД (Скоро)
         </div>
      </div>
    </div>
  );
};

export default SettingsPage;