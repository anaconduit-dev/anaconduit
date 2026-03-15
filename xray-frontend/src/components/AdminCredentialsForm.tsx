import { useState } from 'react';
import { ShieldCheck, AlertCircle, Loader2, Shield } from 'lucide-react';
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
    <form onSubmit={handleSubmit} className="p-8 space-y-6 animate-in fade-in duration-500">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold animate-shake">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Секция текущего доступа */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 ml-1">
          <Shield size={12} className="text-indigo-500" />
          <label className="text-[10px] font-black text-muted uppercase tracking-[0.1em]">Верификация</label>
        </div>
        <input
          type="password"
          required
          placeholder="Текущий пароль администратора"
          className="w-full bg-main border border-line rounded-2xl px-5 py-4 text-base text-sm focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all placeholder:text-muted/30"
          value={formData.current_password}
          onChange={e => setFormData({...formData, current_password: e.target.value})}
        />
      </div>

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-line/50"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-[9px] font-black text-muted uppercase tracking-widest">Новые данные</span>
        </div>
      </div>

      {/* Новый логин */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-muted uppercase ml-1 tracking-wider">Новый логин (Username)</label>
        <input
          type="text"
          required
          placeholder="Напр: admin_proxy"
          className="w-full bg-card border border-line rounded-2xl px-5 py-4 text-base text-sm focus:border-indigo-500/50 outline-none transition-all"
          value={formData.new_username}
          onChange={e => setFormData({...formData, new_username: e.target.value})}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Новый пароль */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-muted uppercase ml-1 tracking-wider">Новый пароль</label>
          <input
            type="password"
            required
            placeholder="••••••••"
            className="w-full bg-card border border-line rounded-2xl px-5 py-4 text-base text-sm focus:border-indigo-500/50 outline-none transition-all"
            value={formData.new_password}
            onChange={e => setFormData({...formData, new_password: e.target.value})}
          />
        </div>
        {/* Подтверждение */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-muted uppercase ml-1 tracking-wider">Повтор пароля</label>
          <input
            type="password"
            required
            placeholder="••••••••"
            className={`w-full bg-card border rounded-2xl px-5 py-4 text-base text-sm outline-none transition-all ${
              formData.confirm_password && formData.new_password !== formData.confirm_password 
              ? 'border-red-500/50 focus:border-red-500' 
              : 'border-line focus:border-indigo-500/50'
            }`}
            value={formData.confirm_password}
            onChange={e => setFormData({...formData, confirm_password: e.target.value})}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || (formData.new_password !== formData.confirm_password && formData.confirm_password !== "")}
        className={`w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-3 mt-4 shadow-xl active:scale-[0.98] 
          ${loading 
            ? 'bg-main text-muted cursor-not-allowed' 
            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20'}`}
      >
        {loading ? (
          <Loader2 className="animate-spin" size={18} />
        ) : (
          <ShieldCheck size={18} className={formData.new_password && formData.new_password === formData.confirm_password ? 'text-emerald-400' : ''} />
        )}
        {loading ? 'Обновление данных...' : 'Применить изменения'}
      </button>
    </form>
  );
};

export default AdminCredentialsForm;