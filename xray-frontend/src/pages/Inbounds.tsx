import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import AddInboundModal from "../components/AddInboundModal";
import { 
  Plus, 
  Trash2, 
  Globe, 
  Server,
  Zap,
  Loader2,
  AlertCircle,
  Users
} from "lucide-react";
import { getInbounds, deleteInbound } from "../api/user";

interface ContextType {
  refreshStatus?: () => Promise<void>;
}

export default function InboundsPage() {
  const context = useOutletContext<ContextType>() || {};
  const { refreshStatus } = context;
  
  const [inbounds, setInbounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadInbounds = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getInbounds();
      setInbounds(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("API Error:", e);
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInbounds(); }, []);

  const handleDelete = async (id: number, tag: string) => {
    if (window.confirm(`Удалить инбаунд "${tag}"?`)) {
      try {
        await deleteInbound(id);
        loadInbounds();
        if (refreshStatus) refreshStatus();
      } catch (e) {
        alert("Не удалось удалить");
      }
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Server className="text-indigo-600" size={32} />
            Инбаунды
          </h1>
          <p className="text-slate-500 font-medium">Активные порты Xray Core</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus size={20} />
          ДОБАВИТЬ ПОРТ
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-300" size={48} /></div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-6 rounded-3xl flex items-center gap-3">
          <AlertCircle /> {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {inbounds.map((inbound) => (
            <div key={inbound.id} className="bg-white rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all relative group overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-3 rounded-2xl ${inbound.is_running_in_xray ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                    <Zap size={24} fill={inbound.is_running_in_xray ? "currentColor" : "none"} />
                  </div>
                  <button 
                    onClick={() => handleDelete(inbound.id, inbound.tag)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <h3 className="text-lg font-bold text-slate-800 mb-1 truncate" title={inbound.tag}>
                  {inbound.tag}
                </h3>
                
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">
                  <Globe size={12} />
                  {inbound.protocol}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Порт</p>
                    <p className="text-xl font-mono font-bold text-slate-700">{inbound.port}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Клиенты</p>
                    <div className="flex items-center justify-end gap-1.5 text-xl font-mono font-bold text-slate-700">
                      <Users size={16} className="text-slate-300" />
                      {inbound.clients_count}
                    </div>
                  </div>
                </div>
              </div>

              {/* Статус-бар внизу */}
              <div className={`py-2 px-6 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${inbound.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${inbound.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                {inbound.is_active ? 'Active' : 'Disabled'}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddInboundModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => { loadInbounds(); if (refreshStatus) refreshStatus(); }} 
      />
    </div>
  );
}