import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
    if (!window.confirm(t("modals.userDetail.removeConfirm", { tag }))) return;
    
    setIsDeleting(inboundId);
    try {
      await removeUserFromInbound(user.id, inboundId);
      onRefresh(); 
      onClose();   
    } catch (err) {
      alert(t("modals.userDetail.removeError"));
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-main/60 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      {/* Zoomed QR Overlay */}
      {zoomedQr && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center bg-main/90 backdrop-blur-xl animate-in zoom-in-95 cursor-zoom-out" 
          onClick={() => setZoomedQr(null)}
        >
          <div className="bg-white p-10 rounded-[3rem] relative shadow-[0_0_50px_rgba(0,0,0,0.3)]" onClick={e => e.stopPropagation()}>
            <QRCode value={zoomedQr} size={320} viewBox={`0 0 256 256`} />
            <button 
              className="absolute -top-14 right-0 text-white flex items-center gap-2 font-black uppercase text-[10px] tracking-widest hover:text-indigo-400 transition-colors"
              onClick={() => setZoomedQr(null)}
            >
              {t("modals.userDetail.close")} <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Main Modal */}
      <div 
        className="bg-main w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[95vh] flex flex-col border border-line animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-8 border-b border-line flex justify-between items-center bg-card/30">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-900/20">
              <ShieldCheck size={22}/>
            </div>
            <div>
              <h2 className="text-lg font-black text-base leading-none tracking-tight">{user.email}</h2>
              <p className="text-[9px] text-muted font-black mt-2 uppercase tracking-[0.15em]">
                {t("modals.userDetail.title")}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 hover:bg-card rounded-2xl text-muted transition-all active:scale-90"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto space-y-10 custom-scrollbar">
          {/* Subscription Card (Dark Style) */}
          <div className="bg-[#0c0c0e] border border-white/5 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl">
            <Globe className="absolute -right-12 -bottom-12 text-white/[0.03] rotate-12" size={200} />
            <div className="relative z-10 space-y-6">
                <div>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">
                    {t("modals.userDetail.subLinkTitle")}
                  </p>
                  <div className="flex gap-3">
                    <div className="flex-1 ...">
                      {loading ? t("modals.userDetail.generating") : linksData?.link_subscription}
                    </div>
                    <button 
                      onClick={() => handleCopy(linksData?.link_subscription, 'sub_link')} 
                      className={`p-4 rounded-2xl transition-all active:scale-90 ${
                        copiedTag === 'sub_link' 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-white text-slate-900 hover:bg-indigo-50'
                      }`}
                    >
                      {copiedTag === 'sub_link' ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                    </button>
                  </div>
                </div>
            </div>
          </div>

          {/* Connections List */}
          <div className="space-y-5">
            <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-3 ml-1">
              <Zap size={14} className="text-amber-500" /> {t("modals.userDetail.connectionsTitle")}
            </h3>

            {loading ? (
              <div className="py-20 flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
                <span className="text-[10px] font-black text-muted uppercase tracking-widest">
                  {t("modals.userDetail.loadingLinks")}
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {linksData?.links.map((item: any, idx: number) => {
                  const clientData = user.clients?.find((c: any) => c.inbound?.tag === item.tag);

                  return (
                    <div 
                      key={idx} 
                      className="flex items-center gap-5 p-5 bg-card/30 border border-line rounded-[2rem] hover:border-indigo-500/30 transition-all group"
                    >
                      {/* QR Thumbnail */}
                      <div 
                        className="relative bg-white p-2 rounded-2xl border border-line cursor-zoom-in shrink-0 group/qr shadow-sm transition-transform active:scale-95"
                        onClick={() => setZoomedQr(item.link)}
                      >
                        <QRCode value={item.link} size={52} viewBox={`0 0 256 256`} />
                        <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover/qr:opacity-100 transition-opacity flex items-center justify-center rounded-2xl backdrop-blur-[1px]">
                          <Maximize2 size={16} className="text-indigo-600" />
                        </div>
                      </div>

                      {/* Link Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[8px] font-black bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-lg uppercase border border-indigo-500/20 tracking-tighter">
                            {item.protocol}
                          </span>
                          <span className="text-sm font-bold text-base truncate tracking-tight">{item.tag}</span>
                        </div>
                        <p className="text-[10px] text-muted font-mono truncate opacity-60">
                          {item.link}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleCopy(item.link, item.tag)}
                          className={`p-3 rounded-2xl transition-all active:scale-90 ${
                            copiedTag === item.tag 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-main border border-line text-muted hover:text-indigo-500 hover:border-indigo-500/50'
                          }`}
                        >
                          {copiedTag === item.tag ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                        </button>

                        {clientData && (
                          <button 
                            disabled={isDeleting === clientData.inbound_id}
                            onClick={() => handleRemoveInbound(clientData.inbound_id, item.tag)}
                            className="p-3 text-muted/40 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all disabled:opacity-30 active:scale-90"
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
        
        {/* Optional Modal Footer */}
        <div className="p-4 bg-card/20 border-t border-line text-center">
        <span className="text-[8px] font-black text-muted/30 uppercase tracking-[0.3em]">
            {t("modals.userDetail.footerInfo")}
          </span>
        </div>
      </div>
    </div>
  );
}