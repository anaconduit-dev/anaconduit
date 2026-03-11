import { useState, useEffect, useCallback } from "react";
import UserDetailModal from "../components/UserDetailModal";
import AddClientModal from "../components/AddClientModal";
import UpdateLimitsModal from "../components/UpdateLimitsModal"
import { 
  UserPlus, Clock, Zap, 
  Trash2, Key, Search, Loader2, AlertCircle,
  CheckCircle2, Copy, PlusCircle, Activity
} from "lucide-react";
import { getUsers, deleteFullUser, resetSubscriptionToken } from "../api/user";

export default function UsersPage() {
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshInterval, setRefreshInterval] = useState<number>(0); 
  const [previousData, setPreviousData] = useState<Record<number, number>>({});
  const [onlineUsers, setOnlineUsers] = useState<Record<number, boolean>>({});
  const [userSpeeds, setUserSpeeds] = useState<Record<number, string>>({});
  const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [userForNewInbound, setUserForNewInbound] = useState<any | null>(null);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [userForLimits, setUserForLimits] = useState<any | null>(null);

  const handleOpenLimits = (e: React.MouseEvent, user: any) => {
    e.stopPropagation();
    setUserForLimits(user);
    setIsLimitModalOpen(true);
  };

  // Утилита для красивого вывода скорости
  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond <= 0.1) return ""; // Игнорируем шум
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const loadData = useCallback(async () => {
    try {
      const now = Date.now();
      // Вычисляем реальный интервал времени между запросами (в секундах)
      const interval = (now - lastFetchTime) / 1000; 
      
      const data = await getUsers();
      const usersArray = Array.isArray(data) ? data : [];
      
      const newOnlineMap: Record<number, boolean> = {};
      const newDataMap: Record<number, number> = {};
      const newSpeedsMap: Record<number, string> = {};

      usersArray.forEach(u => {
        const currentTotal = u.total_up + u.total_down;
        newDataMap[u.id] = currentTotal;
        
        if (previousData[u.id] !== undefined) {
          const diff = currentTotal - previousData[u.id];
          if (diff > 0) {
            newOnlineMap[u.id] = true;
            const bytesPerSecond = diff / interval;
            newSpeedsMap[u.id] = formatSpeed(bytesPerSecond);
          }
        }
      });

      setOnlineUsers(newOnlineMap);
      setUserSpeeds(newSpeedsMap);
      setPreviousData(newDataMap);
      setLastFetchTime(now);
      setUsers(usersArray);
      setError(null);
    } catch (e) {
      setError("Ошибка обновления данных");
    } finally {
      setLoading(false);
    }
  }, [previousData, lastFetchTime]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Только при первой загрузке

  useEffect(() => {
    if (refreshInterval > 0) {
      const timer = setInterval(loadData, refreshInterval * 1000);
      return () => clearInterval(timer);
    }
  }, [refreshInterval, loadData]);

  const formatSmallTraffic = (bytes: number) => {
    if (bytes === 0) return "0";
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  };

  const handleAddNewUser = () => {
    setUserForNewInbound(null);
    setIsAddModalOpen(true);
  };

  const handleAddInboundToExisting = (e: React.MouseEvent, user: any) => {
    e.stopPropagation();
    setUserForNewInbound(user);
    setIsAddModalOpen(true);
  };

  const handleCopy = async (e: React.MouseEvent, text: string, tag: string) => {
    e.stopPropagation();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
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
          <p className="text-slate-500 font-medium">Управление доступом и мониторинг трафика</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <Clock size={16} className="text-slate-400 ml-2" />
          <select 
            value={refreshInterval} 
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="text-xs font-bold uppercase bg-transparent border-none focus:ring-0 cursor-pointer text-slate-600 outline-none"
          >
            <option value={0}>Обновление: ВЫКЛ</option>
            <option value={5}>5 секунд</option>
            <option value={15}>15 секунд</option>
            <option value={60}>1 минута</option>
          </select>
          {refreshInterval > 0 && <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse mr-2" />}
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

      {loading && users.length === 0 ? (
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
            // Вычисляем данные для отображения
            const usedGB = (user.total_up + user.total_down) / (1024 ** 3);
            
            // Конвертируем байты из БД в ГБ для отображения (как в модалке)
            const limitGB = user.traffic_limit ? Math.floor(user.traffic_limit / (1024 ** 3)) : 0;
            
            const percent = limitGB > 0 ? Math.min((usedGB / limitGB) * 100, 100) : 0;
            const isOnline = onlineUsers[user.id];

            // Форматируем дату окончания
            const expiryDate = user.expiry_time ? new Date(user.expiry_time).toLocaleDateString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit'
            }) : null;

            return (
              <div 
                key={user.id} 
                onClick={() => setSelectedUser(user)}
                className="bg-white rounded-[24px] border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all overflow-hidden group cursor-pointer"
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${user.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                      {isOnline && (
                        <div className="flex flex-col items-start">
                          <span className="flex items-center gap-1 text-[10px] font-black text-indigo-500 uppercase animate-pulse">
                            <Zap size={10} fill="currentColor" /> Live
                          </span>
                          {userSpeeds[user.id] && (
                            <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
                              {userSpeeds[user.id]}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => handleAddInboundToExisting(e, user)} 
                        className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-400 hover:text-indigo-600"
                        title="Добавить протокол"
                      >
                        <PlusCircle size={14} />
                      </button>
                      <button 
                        onClick={(e) => handleOpenLimits(e, user)} 
                        className="p-1.5 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-600"
                        title="Лимиты"
                      >
                        <Activity size={14} />
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

                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-tighter text-slate-400">
                      <div className="flex gap-2">
                        <span className="text-slate-700">{usedGB.toFixed(1)} GB</span>
                        <span>/</span>
                        <span>{limitGB > 0 ? `${limitGB} GB` : '∞'}</span>
                      </div>
                      {expiryDate && (
                        <span className={user.is_active ? "text-indigo-500" : "text-red-500"}>
                          до {expiryDate}
                        </span>
                      )}
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-700 ${
                          !user.is_active ? 'bg-red-400' : percent > 85 ? 'bg-amber-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${limitGB > 0 ? percent : 100}%`, opacity: user.is_active ? 1 : 0.5 }}
                      />
                    </div>
                  </div>

                  {/* ... (остальная часть с клиентами без изменений) */}

                  <div className="space-y-1 border-t border-slate-50 pt-3">
                    {user.clients && user.clients.length > 0 ? (
                      user.clients.map((client: any) => (
                        <div key={client.id} className="flex items-center justify-between text-[10px] bg-slate-50/50 p-1.5 rounded-lg border border-slate-100/50">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-black text-indigo-500 uppercase px-1 bg-indigo-50 rounded italic text-[8px]">
                              {client.inbound?.protocol}
                            </span>
                            <span className="text-slate-600 font-medium truncate">{client.inbound?.tag}</span>
                          </div>
                          <span className="text-slate-400 font-mono shrink-0">
                            {formatSmallTraffic(client.up + client.down)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-[9px] text-slate-400 italic text-center py-1">
                        Нет активных подключений
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedUser && (
        <UserDetailModal 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)} 
          onRefresh={loadData} 
        />
      )}
      <UpdateLimitsModal 
        isOpen={isLimitModalOpen}
        user={userForLimits}
        onClose={() => {
          setIsLimitModalOpen(false);
          setUserForLimits(null);
        }}
        onSuccess={loadData}
      />
      <AddClientModal 
        isOpen={isAddModalOpen}
        existingUser={userForNewInbound}
        onClose={() => {
            setIsAddModalOpen(false);
            setUserForNewInbound(null);
        }}
        onSuccess={() => {
            loadData();
        }}
      />
    </div>
  );
}