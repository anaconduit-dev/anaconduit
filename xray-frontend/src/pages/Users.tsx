import { useState, useEffect } from "react";
import UserDetailModal from "../components/UserDetailModal";
import AddClientModal from "../components/AddClientModal"; 
import { 
  UserPlus, 
  Trash2,
  Key,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Copy,
  PlusCircle // Добавил иконку для привязки инбаунда
} from "lucide-react";
import { getUsers, deleteFullUser, resetSubscriptionToken } from "../api/user";

export default function UsersPage() {
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Состояние для модалки добавления
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [userForNewInbound, setUserForNewInbound] = useState<any | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Ошибка загрузки пользователей", e);
      setError("Не удалось загрузить список пользователей");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Хендлер для открытия модалки создания нового
  const handleAddNewUser = () => {
    setUserForNewInbound(null); // Явно сбрасываем, чтобы модалка была пустой
    setIsAddModalOpen(true);
  };

  // Хендлер для добавления инбаунда существующему
  const handleAddInboundToExisting = (e: React.MouseEvent, user: any) => {
    e.stopPropagation();
    setUserForNewInbound(user);
    setIsAddModalOpen(true);
  };

  const handleCopy = async (e: React.MouseEvent, text: string, tag: string) => {
    e.stopPropagation();
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopiedTag(tag);
      setTimeout(() => setCopiedTag(null), 2000);
    } catch (err) { console.error("Ошибка копирования", err); }
  };

  const handleDelete = (e: React.MouseEvent, id: number, name: string) => {
    e.stopPropagation();
    if (window.confirm(`Полностью удалить пользователя ${name}?`)) {
      deleteFullUser(id).then(() => loadData()).catch(() => alert("Ошибка при удалении"));
    }
  };

  const handleResetToken = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    resetSubscriptionToken(id)
      .then(() => {
        alert("Токен успешно сброшен");
        loadData();
      })
      .catch(() => alert("Ошибка при сбросе токена"));
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.subscription_token?.includes(searchTerm)
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Пользователи</h1>
          <p className="text-slate-500 font-medium">Управление доступом и вложенными клиентами</p>
        </div>
      </header>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text"
          placeholder="Поиск по email или токену..."
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
          <p className="text-xs font-bold uppercase tracking-widest">Загрузка базы...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-100 p-6 rounded-[32px] text-red-700 flex items-center gap-4">
          <AlertCircle size={24} />
          <p className="font-medium">{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          
          {/* КАРТОЧКА ПЛЮС (Добавление нового) */}
          <div 
            onClick={handleAddNewUser}
            className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[24px] flex flex-col items-center justify-center p-5 group cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all min-h-[200px]"
          >
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm mb-3">
                <UserPlus size={24} />
            </div>
            <span className="text-xs font-black uppercase text-slate-400 group-hover:text-indigo-600">Добавить клиента</span>
          </div>

          {filteredUsers.map((user) => {
            const used = (user.total_up + user.total_down) / (1024 ** 3);
            const limit = user.traffic_limit || 0;
            const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

            return (
              <div 
                key={user.id} 
                onClick={() => setSelectedUser(user)}
                className="bg-white rounded-[24px] border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all overflow-hidden group cursor-pointer"
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className={`w-3 h-3 rounded-full ${user.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} />
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* КНОПКА ДОБАВИТЬ ИНБАУНД */}
                      <button 
                        onClick={(e) => handleAddInboundToExisting(e, user)} 
                        className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-400 hover:text-indigo-600"
                        title="Добавить в другой инбаунд"
                      >
                        <PlusCircle size={14} />
                      </button>
                      <button onClick={(e) => handleResetToken(e, user.id)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600">
                        <Key size={14} />
                      </button>
                      <button onClick={(e) => handleDelete(e, user.id, user.email)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-800 mb-1 truncate">{user.email}</h3>
                  
                  <div className="flex items-center justify-between gap-2 mb-4 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-mono text-slate-500 truncate">
                      {user.subscription_token}
                    </span>
                    
                    <button 
                      onClick={(e) => handleCopy(e, user.subscription_token, `token-${user.id}`)}
                      className={`p-2 rounded-lg transition-all active:scale-90 shrink-0 ${
                        copiedTag === `token-${user.id}` 
                          ? 'bg-emerald-500 text-white shadow-sm' 
                          : 'bg-white text-indigo-500 hover:text-indigo-700 shadow-sm border border-slate-100'
                      }`}
                    >
                      {copiedTag === `token-${user.id}` ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                      <span>{used.toFixed(1)} GB</span>
                      <span>{limit > 0 ? `${limit} GB` : '∞'}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-700 ${percent > 85 ? 'bg-red-500' : 'bg-indigo-600'}`}
                        style={{ width: `${limit > 0 ? percent : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Модалка детальной информации */}
      {selectedUser && (
        <UserDetailModal 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)} 
          onRefresh={loadData} // Передаем функцию загрузки данных
        />
      )}

      {/* Модалка создания/привязки клиента */}
      <AddClientModal 
        isOpen={isAddModalOpen}
        existingUser={userForNewInbound}
        onClose={() => {
            setIsAddModalOpen(false);
            setUserForNewInbound(null);
        }}
        onSuccess={() => {
            loadData(); // Перезагружаем список после добавления
        }}
      />
    </div>
  );
}