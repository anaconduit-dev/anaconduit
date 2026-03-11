import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import AddInboundModal from "../components/AddInboundModal";
import EditInboundModal from "../components/EditInboundModal"; 
import {  
  Trash2, 
  Globe, 
  Server,
  Zap,
  Loader2,
  AlertCircle,
  Users,
  Settings2,
  PlusCircle
} from "lucide-react";
import { getInbounds, deleteInbound } from "../api/inbound";

interface ContextType {
  refreshStatus?: () => Promise<void>;
}

export default function InboundsPage() {
  const context = useOutletContext<ContextType>() || {};
  const { refreshStatus } = context;
  
  const [inbounds, setInbounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedInboundId, setSelectedInboundId] = useState<number | null>(null);

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

  const handleDelete = async (e: React.MouseEvent, id: number, tag: string) => {
    e.stopPropagation();
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

  const handleEdit = (id: number) => {
    setSelectedInboundId(id);
    setIsEditModalOpen(true);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Server className="text-indigo-600" size={32} />
          Инбаунды
        </h1>
        <p className="text-slate-500 font-medium">Активные порты Xray Core</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-300" size={48} /></div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-6 rounded-[32px] flex items-center gap-3 border border-red-100">
          <AlertCircle /> {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          
          {/* КАРТОЧКА ПЛЮС (Добавление нового порта) */}
          <div 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center p-6 group cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all min-h-[280px]"
          >
            <div className="w-16 h-16 bg-white rounded-[24px] flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm mb-4">
              <PlusCircle size={32} />
            </div>
            <span className="text-sm font-black uppercase text-slate-400 group-hover:text-indigo-600 tracking-widest">
              Добавить порт
            </span>
          </div>

          {inbounds.map((inbound) => (
            <div key={inbound.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all relative group overflow-hidden flex flex-col justify-between min-h-[180px]">
              <div className="p-4"> {/* Уменьшили паддинг с 6 до 4 */}
                <div className="flex justify-between items-start mb-3"> {/* Уменьшили отступ с 6 до 3 */}
                  <div className={`p-2 rounded-xl ${inbound.is_running_in_xray ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                    <Zap size={18} fill={inbound.is_running_in_xray ? "currentColor" : "none"} />
                  </div>
                  
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEdit(inbound.id)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    >
                      <Settings2 size={14} />
                    </button>
                    <button 
                      onClick={(e) => handleDelete(e, inbound.id, inbound.tag)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-800 mb-0.5 truncate" title={inbound.tag}>
                  {inbound.tag}
                </h3>
                
                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-wider mb-4">
                  <Globe size={10} />
                  {inbound.protocol}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-50">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Порт</p>
                    <p className="text-base font-mono font-bold text-slate-700 leading-none">{inbound.port}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Клиенты</p>
                    <div className="flex items-center justify-end gap-1 text-base font-mono font-bold text-slate-700 leading-none">
                      <Users size={14} className="text-slate-300" />
                      {inbound.clients_count}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`py-1.5 px-4 text-[8px] font-black uppercase tracking-widest flex items-center gap-2 ${inbound.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                <div className={`w-1 h-1 rounded-full ${inbound.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                {inbound.is_active ? 'Active' : 'Disabled'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модалки остаются без изменений */}
      <AddInboundModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={() => { loadInbounds(); if (refreshStatus) refreshStatus(); }} 
      />

      <EditInboundModal 
        isOpen={isEditModalOpen} 
        inboundId={selectedInboundId}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedInboundId(null);
        }} 
        onSuccess={() => { 
          loadInbounds(); 
          if (refreshStatus) refreshStatus(); 
        }} 
      />
    </div>
  );
}