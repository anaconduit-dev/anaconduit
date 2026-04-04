import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "react-i18next";
import { toast } from 'react-hot-toast';
import { 
  Globe, Download, Trash2, Plus, X, Edit2, Check,
  RefreshCw, Loader2, AlertCircle, CheckCircle2, Clock
} from 'lucide-react';
import { useConfirm } from "../context/ConfirmContext";
import { 
  getResources, addResource, deleteResource, updateResource,
  syncResource, type XrayResource 
} from "../api/resources";

interface ResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ResourceModal({ isOpen, onClose }: ResourceModalProps) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  
  const [resources, setResources] = useState<XrayResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Состояния для редактирования
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<XrayResource>>({});

  // Состояние для новой записи
  const [newRes, setNewRes] = useState({
    filename: '',
    url: '',
    auto_update: true,
    update_interval: 168
  });

  const fetchResources = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getResources();
      setResources(data);
    } catch (err) {
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isOpen) fetchResources();
  }, [isOpen, fetchResources]);

  // --- Actions ---

  const handleAdd = async () => {
    if (!newRes.filename || !newRes.url) return toast.error(t("common.fillAll"));
    try {
      await addResource(newRes);
      toast.success(t("common.success"));
      setShowAddForm(false);
      setNewRes({ filename: '', url: '', auto_update: true, update_interval: 168 });
      fetchResources();
    } catch (err) {
      toast.error(t("common.error"));
    }
  };

  const handleEditStart = (res: XrayResource) => {
    setEditingId(res.id);
    setEditData({ ...res });
  };

  const handleEditSave = async () => {
    if (!editingId) return;
    if (!editData.filename || !editData.url) return toast.error(t("common.fillAll"));
    
    try {
      await updateResource(editingId, editData);
      toast.success(t("common.success"));
      setEditingId(null);
      fetchResources();
    } catch (err) {
      toast.error(t("common.error"));
    }
  };

  const handleDelete = async (res: XrayResource) => {
    const isConfirmed = await confirm({
      title: t("common.delete"),
      message: t("system.resourceDeleteConfirm", { name: res.filename }),
      type: 'danger'
    });
    if (!isConfirmed) return;

    try {
      await deleteResource(res.id);
      toast.success(t("common.success"));
      fetchResources();
    } catch (err) {
      toast.error(t("common.error"));
    }
  };

  const handleSync = async (id?: number) => {
    const toastId = toast.loading(t("system.syncing"));
    try {
      await syncResource(id);
      toast.success(t("system.syncSuccess"), { id: toastId });
      fetchResources();
    } catch (err) {
      toast.error(t("system.syncError"), { id: toastId });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111111] border border-white/10 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <Globe className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t("system.geoResources")}</h2>
              <p className="text-xs text-gray-500 italic">GeoIP & GeoSite automation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
                onClick={() => handleSync()} 
                className="p-2 hover:bg-white/5 rounded-full text-blue-400 transition-colors"
                title={t("system.syncAll")}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-400">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Form to Add (Collapsible) */}
        {showAddForm && (
          <div className="p-6 bg-emerald-500/5 border-b border-white/5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                type="text" 
                placeholder="geoip.dat"
                className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-emerald-500/50 transition-all text-sm"
                value={newRes.filename}
                onChange={e => setNewRes({...newRes, filename: e.target.value})}
              />
              <input 
                type="text" 
                placeholder="https://github.com/..."
                className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-emerald-500/50 transition-all text-sm"
                value={newRes.url}
                onChange={e => setNewRes({...newRes, url: e.target.value})}
              />
            </div>
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4 text-xs text-gray-400">
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                        <input 
                          type="checkbox" 
                          checked={newRes.auto_update} 
                          onChange={e => setNewRes({...newRes, auto_update: e.target.checked})} 
                          className="rounded bg-white/10 border-white/10 text-emerald-600 focus:ring-0" 
                        />
                        {t("system.autoUpdate")}
                    </label>
                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <input 
                        type="number" 
                        className="bg-transparent w-14 text-center text-white outline-none focus:text-emerald-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                        value={newRes.update_interval} 
                        onChange={e => setNewRes({...newRes, update_interval: Number(e.target.value)})} 
                        />
                        <span className="text-[10px] text-gray-500 uppercase font-bold">hours</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">{t("common.cancel")}</button>
                    <button onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl text-sm font-bold transition-all">{t("common.add")}</button>
                </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {!showAddForm && !editingId && (
            <div className="flex justify-end mb-4">
                <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 text-emerald-500 hover:bg-emerald-500/10 px-4 py-2 rounded-xl transition-all font-bold text-xs uppercase tracking-widest"
                >
                <Plus className="w-4 h-4" />
                {t("system.addResource")}
                </button>
            </div>
          )}

          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-emerald-500 animate-spin" /></div>
            ) : resources.length > 0 ? (
              resources.map((r) => (
                <div key={r.id} className={`flex items-center justify-between p-4 bg-white/5 border rounded-2xl transition-all duration-300 ${editingId === r.id ? 'border-blue-500/40 bg-blue-500/5 shadow-lg shadow-blue-500/5' : 'border-white/5'}`}>
                  
                  {editingId === r.id ? (
                    /* EDIT MODE */
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 mr-4">
                        <input 
                            className="bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500/50"
                            value={editData.filename}
                            onChange={e => setEditData({...editData, filename: e.target.value})}
                        />
                        <input 
                            className="bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500/50"
                            value={editData.url}
                            onChange={e => setEditData({...editData, url: e.target.value})}
                        />
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-[10px] text-gray-400 cursor-pointer hover:text-white">
                                <input 
                                  type="checkbox" 
                                  checked={editData.auto_update} 
                                  onChange={e => setEditData({...editData, auto_update: e.target.checked})} 
                                  className="rounded bg-white/10 border-white/10 text-blue-600"
                                />
                                {t("system.autoUpdate")}
                            </label>
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 bg-black/20 px-2 py-1 rounded-md">
                                <Clock className="w-3 h-3" />
                                <input 
                                    type="number"
                                    className="bg-transparent w-12 text-center text-white outline-none focus:text-blue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    value={editData.update_interval}
                                    onChange={e => setEditData({...editData, update_interval: Number(e.target.value)})}
                                />
                                <span>hours</span>
                            </div>
                        </div>
                    </div>
                  ) : (
                    /* VIEW MODE */
                    <div className="flex items-center gap-4 overflow-hidden">
                        <div className={`p-2.5 rounded-xl ${
                            r.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 
                            r.status === 'failed' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                        }`}>
                        {r.status === 'success' ? <CheckCircle2 className="w-5 h-5" /> : 
                        r.status === 'failed' ? <AlertCircle className="w-5 h-5" /> : <RefreshCw className="w-5 h-5 animate-spin" />}
                        </div>
                        <div className="overflow-hidden">
                            <div className="text-sm font-black text-gray-200 truncate italic">{r.filename}</div>
                            <div className="text-[10px] text-gray-500 truncate max-w-[200px] sm:max-w-[300px] opacity-60">{r.url}</div>
                            <div className="flex gap-3 mt-1.5 text-[9px] font-bold uppercase tracking-wider">
                                <span className={r.auto_update ? "text-emerald-500/70" : "text-gray-600"}>
                                    {r.auto_update ? `Every ${r.update_interval}h` : "Manual Only"}
                                </span>
                                <span className="text-gray-600 border-l border-white/10 pl-3">
                                    {r.last_updated ? new Date(r.last_updated).toLocaleString() : 'Never Updated'}
                                </span>
                            </div>
                        </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1 ml-2">
                    {editingId === r.id ? (
                        <>
                            <button onClick={handleEditSave} className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded-xl transition-all" title={t("common.save")}>
                                <Check className="w-5 h-5" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-2 text-gray-400 hover:bg-white/10 rounded-xl transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => handleSync(r.id)}
                                className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all"
                                title={t("system.syncNow")}
                            >
                                <Download className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => handleEditStart(r)}
                                className="p-2 text-gray-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-xl transition-all"
                                title={t("common.edit")}
                            >
                                <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => handleDelete(r)}
                                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-20 text-gray-500">
                <Globe className="w-12 h-12 mx-auto mb-4 opacity-5" />
                <p className="text-xs uppercase tracking-[0.2em] font-black">{t("system.noResources")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}