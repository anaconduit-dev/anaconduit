import { useState, useEffect, useCallback } from "react";
import { toast } from 'react-hot-toast';
import { useTranslation } from "react-i18next";
import UserDetailModal from "../components/UserDetailModal";
import AddClientModal from "../components/AddClientModal";
import UpdateLimitsModal from "../components/UpdateLimitsModal"
import { useConfirm } from "../context/ConfirmContext";
import { 
  UserPlus, Clock, Zap, RotateCcw,
  Trash2, Key, Search, Loader2, AlertCircle,
  CheckCircle2, Copy, PlusCircle, Activity
} from "lucide-react";
import { getUsers, deleteFullUser, resetSubscriptionToken, resetUserTraffic } from "../api/user";

export default function UsersPage() {
  const confirm = useConfirm();
  const { t } = useTranslation();
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

  const handleResetTraffic = async (e: React.MouseEvent, user: any) => {
    e.stopPropagation();

    // Теперь это работает как надо и выглядит красиво!
    const isConfirmed = await confirm({
      title: t("users.resetTraffic") || "Сброс трафика",
      message: t("users.resetTrafficConfirm", { email: user.email }),
      type: 'danger',
      confirmText: t("common.reset"),
      cancelText: t("common.cancel")
    });

    if (!isConfirmed) return;

    // Логика тоста сработает только после подтверждения
    toast.promise(resetUserTraffic(user.id), {
      loading: 'Resetting...',
      success: () => { loadData(); return t("users.resetTrafficSuccess"); },
      error: t("users.resetTrafficError"),
    });
  };

  const handleOpenLimits = (e: React.MouseEvent, user: any) => {
    e.stopPropagation();
    setUserForLimits(user);
    setIsLimitModalOpen(true);
  };

  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond <= 0.1) return ""; 
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const loadData = useCallback(async () => {
    try {
      const now = Date.now();
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
      setError(t("users.updateError"));
    } finally {
      setLoading(false);
    }
  }, [previousData, lastFetchTime, t]);

  useEffect(() => {
    loadData();
  }, []); 

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

  const handleCopy = (e: React.MouseEvent, text: string, tag: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedTag(tag);
    
    toast.success(t("common.copied"), {
      icon: '📋',
      style: { borderRadius: '15px', background: '#1a1a1a', color: '#fff' }
    });
    
    setTimeout(() => setCopiedTag(null), 2000);
  };

  const handleDelete = async (e: React.MouseEvent, id: number, user: any) => {
    e.stopPropagation();
    
    const isConfirmed = await confirm({
      title: t("users.deleteUser") ,
      message: t("users.deleteConfirm", { email: user.email }),
      type: 'danger',
      confirmText: t("common.delete"),
      cancelText: t("common.cancel")
    });

    if (!isConfirmed) return;
    try {
      await deleteFullUser(id);
      toast.success(t("users.deleteSuccess"), {
        icon: '🗑️',
        style: { borderRadius: '15px', background: '#1a1a1a', color: '#fff' }
      });
      loadData();
    } catch (err) {
      toast.error(t("users.deleteError"));
    }
  };

  const handleResetToken = async (e: React.MouseEvent, user: any) => {
    e.stopPropagation();

    const isConfirmed = await confirm({
      title: t("users.resetToken") ,
      message: t("users.resetTokenConfirm", { email: user.email }),
      type: 'danger',
      confirmText: t("common.reset"),
      cancelText: t("common.cancel")
    });

    if (!isConfirmed) return;

    toast.promise(resetSubscriptionToken(user.id), {
      loading: 'Updating token...',
      success: () => {
        loadData();
        return t("users.resetTokenSuccess");
      },
      error: t("users.resetTokenError"),
    });
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.subscription_token?.includes(searchTerm)
  );

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-base tracking-tighter uppercase italic">
              {t("users.title")}<span className="text-indigo-500">.</span>
            </h1>
            <p className="text-muted text-[10px] font-black uppercase tracking-[0.2em] ml-1">
              {t("users.subtitle")}
            </p>
          </div>
          
          <div className="flex items-center gap-3 bg-card border border-line p-2 pl-4 rounded-[1.5rem] shadow-xl">
            <Clock size={14} className="text-indigo-500" />
            <select 
              value={refreshInterval} 
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="text-[10px] font-black uppercase bg-transparent border-none focus:ring-0 cursor-pointer text-base outline-none tracking-widest"
            >
              <option value={0} className="bg-main">{t("users.refresh.off")}</option>
              <option value={10} className="bg-main">{t("users.refresh.seconds", { count: 10 })}</option>
              <option value={15} className="bg-main">{t("users.refresh.seconds", { count: 15 })}</option>
              <option value={60} className="bg-main">{t("users.refresh.minute")}</option>
            </select>
            {refreshInterval > 0 && (
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse mr-2 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            )}
          </div>
        </header>

        {/* Search Bar */}
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-indigo-500 transition-colors" size={20} />
          <input 
            type="text"
            placeholder={t("users.searchPlaceholder")}
            className="w-full pl-14 pr-6 py-5 bg-card border border-line rounded-[2rem] focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-lg text-sm font-bold tracking-tight text-base placeholder:text-muted/50 placeholder:font-normal"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading && users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted gap-4">
            <Loader2 className="animate-spin text-indigo-500" size={40} />
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">{t("users.syncing")}</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/5 border border-red-500/20 p-6 rounded-[2rem] text-red-500 flex items-center gap-4 animate-in zoom-in-95">
            <AlertCircle size={24} />
            <p className="text-sm font-black uppercase tracking-tight">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            
            <div 
              onClick={handleAddNewUser}
              className="bg-main/40 border-2 border-dashed border-line rounded-[2.5rem] flex flex-col items-center justify-center p-8 group cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all duration-300 min-h-[280px]"
            >
              <div className="w-16 h-16 bg-card border border-line rounded-[1.5rem] flex items-center justify-center text-muted group-hover:text-white group-hover:bg-indigo-600 group-hover:border-indigo-500 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-2xl mb-4">
                  <UserPlus size={28} />
              </div>
              <span className="text-[10px] font-black uppercase text-muted tracking-[0.2em] group-hover:text-indigo-500 transition-colors">
                {t("users.newUser")}
              </span>
            </div>

            {filteredUsers.map((user) => {
              const usedGB = (user.total_up + user.total_down) / (1024 ** 3);
              const limitGB = user.traffic_limit ? Math.floor(user.traffic_limit / (1024 ** 3)) : 0;
              const percent = limitGB > 0 ? Math.min((usedGB / limitGB) * 100, 100) : 0;
              const isOnline = onlineUsers[user.id];
              const expiryDate = user.expiry_time ? new Date(user.expiry_time).toLocaleDateString('ru-RU', {
                day: '2-digit', month: '2-digit', year: '2-digit'
              }) : null;

              return (
                <div 
                  key={user.id} 
                  onClick={() => setSelectedUser(user)}
                  className="bg-card border border-line rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:border-indigo-500/30 transition-all duration-300 overflow-hidden group cursor-pointer relative"
                >
                  <div className={`absolute top-0 left-0 w-full h-1 ${user.is_active ? 'bg-emerald-500/20' : 'bg-red-500/20'}`} />
                  
                  <div className="p-6 pt-7 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full relative ${user.is_active ? 'bg-emerald-500' : 'bg-red-500'}`}>
                          {user.is_active && <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-40" />}
                        </div>
                        {isOnline && (
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter flex items-center gap-1">
                              <Zap size={10} fill="currentColor" className="animate-pulse" /> Live
                            </span>
                            {userSpeeds[user.id] && (
                              <span className="text-[8px] font-mono font-black text-muted tracking-tighter">
                                {userSpeeds[user.id]}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-1 lg:opacity-0 lg:group-hover:opacity-100 lg:translate-y-1 lg:group-hover:translate-y-0 transition-all duration-300">
                        <button onClick={(e) => {e.stopPropagation(); handleAddInboundToExisting(e, user)}} className="p-2 hover:bg-indigo-500/10 rounded-xl text-muted hover:text-indigo-500 transition-colors"><PlusCircle size={14} /></button>
                        <button onClick={(e) => {e.stopPropagation(); handleOpenLimits(e, user)}} className="p-2 hover:bg-amber-500/10 rounded-xl text-muted hover:text-amber-500 transition-colors"><Activity size={14} /></button>
                        <button onClick={(e) => {e.stopPropagation(); handleResetToken(e, user)}} className="p-2 hover:bg-indigo-500/10 rounded-xl text-muted hover:text-indigo-400 transition-colors"><Key size={14} /></button>
                        <button onClick={(e) => {e.stopPropagation(); handleDelete(e, user.id, user.email)}} className="p-2 hover:bg-red-500/10 rounded-xl text-muted hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        <button 
                          onClick={(e) => handleResetTraffic(e, user)} 
                          className="p-3 lg:p-2 hover:bg-indigo-500/10 rounded-xl text-muted hover:text-indigo-500 transition-colors"
                          title={t("users.resetTraffic")}
                        >
                          <RotateCcw size={18} className="lg:w-[14px] lg:h-[14px]" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-black text-base uppercase tracking-tight truncate group-hover:text-indigo-400 transition-colors duration-300">
                        {user.email.split('@')[0]}
                        <span className="text-muted text-[10px] lowercase">@{user.email.split('@')[1]}</span>
                      </h3>
                      
                      <div className="flex items-center justify-between gap-2 mt-3 bg-main/50 p-2.5 rounded-2xl border border-line">
                        <span className="text-[9px] font-mono font-bold text-muted truncate">
                          {user.subscription_token}
                        </span>
                        <button 
                          onClick={(e) => {e.stopPropagation(); handleCopy(e, user.subscription_token, `token-${user.id}`)}}
                          className={`p-2 rounded-xl transition-all active:scale-90 shrink-0 shadow-lg ${
                            copiedTag === `token-${user.id}` 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-card text-indigo-500 border border-line hover:border-indigo-500/50'
                          }`}
                        >
                          {copiedTag === `token-${user.id}` ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                        <div className="flex gap-1 items-center">
                          <span className="text-base">{usedGB.toFixed(1)}</span>
                          <span className="text-muted/40">/</span>
                          <span className="text-muted">{limitGB > 0 ? `${limitGB} GB` : '∞'}</span>
                        </div>
                        {expiryDate && (
                          <span className={user.is_active ? "text-indigo-400" : "text-red-500"}>
                            {expiryDate}
                          </span>
                        )}
                      </div>
                      <div className="w-full h-1.5 bg-main rounded-full overflow-hidden border border-line p-[1px]">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${
                            !user.is_active ? 'bg-red-500/50' : percent > 85 ? 'bg-amber-500' : 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]'
                          }`}
                          style={{ width: `${limitGB > 0 ? percent : 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 space-y-1.5 border-t border-line/50">
                      {user.clients && user.clients.length > 0 ? (
                        user.clients.map((client: any) => (
                          <div key={client.id} className="flex items-center justify-between bg-main/30 p-2 rounded-xl border border-line/30 group/item hover:bg-main/60 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-black text-indigo-500 uppercase px-1.5 py-0.5 bg-indigo-500/10 rounded-lg italic text-[8px] border border-indigo-500/20">
                                {client.inbound?.protocol}
                              </span>
                              <span className="text-muted font-bold text-[10px] truncate group-hover/item:text-base transition-colors">{client.inbound?.tag}</span>
                            </div>
                            <span className="text-[9px] font-mono font-black text-muted group-hover/item:text-indigo-400">
                              {formatSmallTraffic(client.up + client.down)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-[9px] text-muted/40 font-black uppercase tracking-widest text-center py-2 italic">
                          {t("users.noNodes")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Components */}
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
          onSuccess={loadData}
        />
      </div>
    </div>
  );
}