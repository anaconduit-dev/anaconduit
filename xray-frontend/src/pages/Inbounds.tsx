import { useState, useEffect } from "react";
import { toast } from 'react-hot-toast';
import { useTranslation } from "react-i18next";
import { useConfirm } from "../context/ConfirmContext";
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
  const confirm = useConfirm();
  const { t } = useTranslation();
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
      
      const isConfirmed = await confirm({
        title: t("inbounds.deleteInbounds") ,
        message: t("inbounds.deleteConfirm", { tag }),
        type: 'danger',
        confirmText: t("common.delete"),
        cancelText: t("common.cancel")
      });
  
      if (!isConfirmed) return;
      try {
        await deleteInbound(id);
        toast.success(t("inbiunds.deleteSuccess"), {
          icon: '🗑️',
          style: { borderRadius: '15px', background: '#1a1a1a', color: '#fff' }
        });
        loadInbounds();
      } catch (err) {
        toast.error(t("users.deleteError"));
      }
    };

  const handleEdit = (id: number) => {
    setSelectedInboundId(id);
    setIsEditModalOpen(true);
  };

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-900/20">
                <Server size={22} />
              </div>
              <h1 className="text-3xl font-black text-base tracking-tighter uppercase italic">
                Инбаунды<span className="text-indigo-500">.</span>
              </h1>
            </div>
            <p className="text-muted text-[10px] font-black uppercase tracking-[0.2em] ml-1">
              Активные входящие порты Xray Core
            </p>
          </div>
          
          {/* Статистика по портам (опционально) */}
          <div className="flex gap-4">
            <div className="px-4 py-2 bg-card border border-line rounded-2xl flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span className="text-[10px] font-black text-base uppercase tracking-widest">
                Всего: <span className="text-indigo-500">{inbounds.length}</span>
              </span>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="animate-spin text-indigo-500" size={48} />
            <span className="text-[10px] font-black text-muted uppercase tracking-[0.3em]">Mapping network ports...</span>
          </div>
        ) : error ? (
          <div className="bg-red-500/5 border border-red-500/20 text-red-400 p-8 rounded-[2.5rem] flex items-center gap-4 animate-shake">
            <AlertCircle size={24} /> 
            <div className="flex flex-col">
              <span className="font-black uppercase text-xs tracking-widest">System Error</span>
              <span className="text-sm opacity-80">{error}</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            
            {/* КАРТОЧКА ПЛЮС */}
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-card/30 border-2 border-dashed border-line rounded-[2.5rem] flex flex-col items-center justify-center p-8 group cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all min-h-[220px] relative overflow-hidden active:scale-[0.98]"
            >
              <div className="w-14 h-14 bg-main border border-line rounded-2xl flex items-center justify-center text-muted group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all shadow-sm mb-4">
                <PlusCircle size={28} />
              </div>
              <span className="text-[10px] font-black uppercase text-muted group-hover:text-indigo-500 tracking-[0.2em]">
                Добавить порт
              </span>
            </button>

            {inbounds.map((inbound) => (
              <div key={inbound.id} className="bg-main rounded-[2.5rem] border border-line shadow-sm hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all relative group overflow-hidden flex flex-col min-h-[220px]">
                <div className="p-7 flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-3 rounded-2xl transition-colors ${inbound.is_running_in_xray ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-900/20' : 'bg-card text-muted'}`}>
                      <Zap size={18} fill={inbound.is_running_in_xray ? "currentColor" : "none"} />
                    </div>
                    
                    <div className="flex gap-2 lg:opacity-0 lg:group-hover:opacity-100 lg:translate-x-2 lg:group-hover:translate-x-0 transition-all duration-300">
                      <button 
                        onClick={() => handleEdit(inbound.id)}
                        className="p-2.5 bg-card text-muted hover:text-indigo-500 hover:border-indigo-500/50 border border-transparent rounded-xl transition-all"
                      >
                        <Settings2 size={14} />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(e, inbound.id, inbound.tag)}
                        className="p-2.5 bg-card text-muted hover:text-red-500 hover:border-red-500/50 border border-transparent rounded-xl transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 mb-6">
                    <h3 className="text-base font-black text-base truncate uppercase tracking-tight" title={inbound.tag}>
                      {inbound.tag}
                    </h3>
                    <div className="flex items-center gap-2 text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                      <Globe size={10} />
                      {inbound.protocol}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-5 border-t border-line/50">
                    <div>
                      <p className="text-[8px] font-black text-muted uppercase tracking-widest mb-1">Порт</p>
                      <p className="text-lg font-mono font-black text-base leading-none">{inbound.port}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-muted uppercase tracking-widest mb-1">Клиенты</p>
                      <div className="flex items-center justify-end gap-1.5 text-lg font-mono font-black text-base leading-none">
                        <Users size={16} className="text-indigo-500/50" />
                        {inbound.clients_count}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Статус-бар внизу карточки */}
                <div className={`py-3 px-7 text-[9px] font-black uppercase tracking-[0.2em] flex items-center justify-between ${inbound.is_active ? 'bg-emerald-500/5 text-emerald-500 border-t border-emerald-500/10' : 'bg-red-500/5 text-red-500 border-t border-red-500/10'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${inbound.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    {inbound.is_active ? 'Active' : 'Disabled'}
                  </div>
                  <span className="opacity-40 text-[8px]">Inbound Core</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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