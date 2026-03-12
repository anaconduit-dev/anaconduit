import { useState } from 'react';
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
// Импортируем нашу чистую функцию
import { updateAdminCredentials } from '../api/admin';

const AdminCredentialsForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const [formData, setFormData] = useState({
    current_password: '',
    new_username: '',
    new_password: '',
    confirm_password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.new_password !== formData.confirm_password) {
      setError('Новые пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      // Используем функцию из API-слоя
      await updateAdminCredentials({
        current_password: formData.current_password,
        new_username: formData.new_username,
        new_password: formData.new_password
      });
      
      onSuccess();
      // Можно добавить уведомление перед перезагрузкой
      window.location.reload(); 
    } catch (err: any) {
      // Обработка ошибки через централизованный формат
      const message = err.response?.data?.detail || 'Ошибка при обновлении данных';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Поле: Текущий пароль */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-wider">Текущий пароль</label>
        <input
          type="password"
          required
          placeholder="••••••••"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
          value={formData.current_password}
          onChange={e => setFormData({...formData, current_password: e.target.value})}
        />
      </div>

      <div className="h-px bg-slate-800/50 my-2" />

      {/* Поле: Новый логин */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-wider">Новый логин</label>
        <input
          type="text"
          required
          placeholder="admin"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
          value={formData.new_username}
          onChange={e => setFormData({...formData, new_username: e.target.value})}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Поле: Новый пароль */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-wider">Новый пароль</label>
          <input
            type="password"
            required
            placeholder="••••••••"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
            value={formData.new_password}
            onChange={e => setFormData({...formData, new_password: e.target.value})}
          />
        </div>
        {/* Поле: Подтверждение */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-wider">Повтор пароля</label>
          <input
            type="password"
            required
            placeholder="••••••••"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
            value={formData.confirm_password}
            onChange={e => setFormData({...formData, confirm_password: e.target.value})}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-blue-900/20 active:scale-[0.98]"
      >
        {loading ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
        {loading ? 'Обновление...' : 'Подтвердить изменения'}
      </button>
    </form>
  );
};

export default AdminCredentialsForm;