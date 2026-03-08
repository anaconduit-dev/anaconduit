import { useState, useEffect } from "react";
import { 
  X, Copy, CheckCircle2, Loader2, 
  ShieldCheck, Zap, Globe, Maximize2, Trash2 
} from "lucide-react"; // Убрал Server, оставил Maximize2
import QRCode from "react-qr-code";
import { getUserConfigLinks } from "../api/subscribe";
import { removeUserFromInbound } from "../api/user";

interface UserDetailModalProps {
  user: any;
  onClose: () => void;
  onRefresh: () => void;
}

export default function UserDetailModal({ user, onClose, onRefresh }: UserDetailModalProps) {
  const [linksData, setLinksData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [zoomedQr, setZoomedQr] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  useEffect(() => {
    const fetchLinks = async () => {
      try {
        const data = await getUserConfigLinks(user.id);
        setLinksData(data);
      } catch (e) {
        console.error("Ошибка загрузки ссылок");
      } finally {
        setLoading(false);
      }
    };
    fetchLinks();
  }, [user.id]);

  const handleCopy = async (text: string, tag: string) => {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopiedTag(tag);
      setTimeout(() => setCopiedTag(null), 2000);
    } catch (err) {
      console.error("Ошибка копирования: ", err);
    }
  };

  const handleRemoveInbound = async (inboundId: number, tag: string) => {
    if (!window.confirm(`Отключить пользователя от сервера "${tag}"?`)) return;
    
    setIsDeleting(inboundId);
    try {
      await removeUserFromInbound(user.id, inboundId);
      onRefresh(); 
      onClose();   
    } catch (err) {
      alert("Не удалось удалить подключение");
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      {zoomedQr && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 animate-in zoom-in-95" onClick={() => setZoomedQr(null)}>
          <div className="bg-white p-8 rounded-[40px] relative">
            <QRCode value={zoomedQr} size={320} viewBox={`0 0 256 256`} />
            <button className="absolute -top-12 right-0 text-white flex items-center gap-2">Закрыть <X size={24} /></button>
          </div>
        </div>
      )}

      <div 
        className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden max-h-[95vh] flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg">
              <ShieldCheck size={22}/>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 leading-none">{user.email}</h2>
              <p className="text-[10px] text-slate-400 font-bold mt-1.5 uppercase tracking-wider">Управление доступом</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20} /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8 custom-scrollbar">
          <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl">
             <Globe className="absolute -right-8 -bottom-8 text-white/5" size={160} />
             <div className="relative z-10 space-y-6">
                <div>
                  <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-3">Subscription Token</p>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-white/10 backdrop-blur-md border border-white/10 text-[11px] p-3 rounded-xl font-mono truncate select-all">
                      {loading ? "..." : linksData?.subscription}
                    </div>
                    <button onClick={() => handleCopy(linksData?.subscription, 'sub')} className={`p-3 rounded-xl transition-all ${copiedTag === 'sub' ? 'bg-emerald-500' : 'bg-white text-slate-900'}`}>
                      {copiedTag === 'sub' ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-3">Public Link</p>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-white/10 backdrop-blur-md border border-white/10 text-[11px] p-3 rounded-xl font-mono truncate select-all">
                      {loading ? "..." : linksData?.link_subscription}
                    </div>
                    <button onClick={() => handleCopy(linksData?.link_subscription, 'sub_link')} className={`p-3 rounded-xl transition-all ${copiedTag === 'sub_link' ? 'bg-emerald-500' : 'bg-white text-slate-900'}`}>
                      {copiedTag === 'sub_link' ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>
             </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Zap size={14} className="text-amber-500" /> Подключения и доступ
            </h3>

            {loading ? (
              <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {linksData?.links.map((item: any, idx: number) => {
                  const clientData = user.clients?.find((c: any) => c.inbound?.tag === item.tag);

                  return (
                    <div key={idx} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-3xl hover:border-indigo-200 transition-all shadow-sm group">
                      <div 
                        className="relative bg-white p-1.5 rounded-xl border border-slate-100 cursor-zoom-in shrink-0 group/qr"
                        onClick={() => setZoomedQr(item.link)}
                      >
                        <QRCode value={item.link} size={48} viewBox={`0 0 256 256`} />
                        {/* Возвращаем Maximize2 как оверлей для красоты и использования импорта */}
                        <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover/qr:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                          <Maximize2 size={16} className="text-indigo-700" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded uppercase border border-indigo-100">
                            {item.protocol}
                          </span>
                          <span className="text-sm font-bold text-slate-800 truncate">{item.tag}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono truncate select-all">
                          {item.link.substring(0, 50)}...
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleCopy(item.link, item.tag)}
                          className={`p-2.5 rounded-xl transition-all ${copiedTag === item.tag ? 'bg-emerald-500 text-white' : 'hover:bg-slate-100 text-slate-400'}`}
                        >
                          {copiedTag === item.tag ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                        </button>

                        {clientData && (
                          <button 
                            disabled={isDeleting === clientData.inbound_id}
                            onClick={() => handleRemoveInbound(clientData.inbound_id, item.tag)}
                            className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
                          >
                            {isDeleting === clientData.inbound_id ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <Trash2 size={18} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}