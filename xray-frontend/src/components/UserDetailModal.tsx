import { useState, useEffect } from "react";
import { 
  X, Copy, CheckCircle2, Loader2, 
  ShieldCheck, Zap, Globe, UserPlus, Maximize2 
} from "lucide-react";
import QRCode from "react-qr-code";
import { getUserConfigLinks } from "../api/subscribe";

interface UserDetailModalProps {
  user: any;
  onClose: () => void;
}

export default function UserDetailModal({ user, onClose }: UserDetailModalProps) {
  const [linksData, setLinksData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  // Состояние для увеличения QR
  const [zoomedQr, setZoomedQr] = useState<string | null>(null);

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

  // Улучшенная функция копирования
  const handleCopy = async (text: string, tag: string) => {
    if (!text) return;

    try {
      // Пытаемся использовать современный API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback для HTTP соединений
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
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
      alert("Не удалось скопировать. Попробуйте вручную.");
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* МОДАЛКА УВЕЛИЧЕННОГО QR */}
      {zoomedQr && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 animate-in zoom-in-95"
          onClick={() => setZoomedQr(null)}
        >
          <div className="bg-white p-8 rounded-[40px] relative shadow-2xl">
            <QRCode value={zoomedQr} size={320} viewBox={`0 0 256 256`} />
            <p className="mt-6 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">
              Сканируйте для подключения
            </p>
            <button className="absolute -top-12 right-0 text-white flex items-center gap-2">
               Закрыть <X size={24} />
            </button>
          </div>
        </div>
      )}

      <div 
        className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (без изменений) */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg">
              <ShieldCheck size={22}/>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 leading-none">{user.email}</h2>
              <p className="text-[10px] text-slate-400 font-bold mt-1.5 uppercase tracking-wider">Ключи доступа</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={20} /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {/* Subscription Card */}
          <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl">
             <Globe className="absolute -right-8 -bottom-8 text-white/5" size={160} />
             <div className="relative z-10">
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-4">Subscription</p>
                <div className="flex gap-3">
                  <div className="flex-1 bg-white/10 backdrop-blur-md border border-white/10 text-[11px] p-3 rounded-xl font-mono text-indigo-100 break-all truncate select-all h-12">
                    {loading ? "..." : linksData?.subscription}
                  </div>
                  <button 
                    onClick={() => handleCopy(linksData?.subscription, 'sub')}
                    className={`p-3.5 rounded-xl transition-all active:scale-95 ${copiedTag === 'sub' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900'}`}
                  >
                    {copiedTag === 'sub' ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                  </button>
                </div>
             </div>
             <div className="relative z-10">
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-4">Subscription Link</p>
                <div className="flex gap-3">
                  <div className="flex-1 bg-white/10 backdrop-blur-md border border-white/10 text-[11px] p-3 rounded-xl font-mono text-indigo-100 break-all truncate select-all h-12">
                    {loading ? "..." : linksData?.link_subscription}
                  </div>
                  <button 
                    onClick={() => handleCopy(linksData?.link_subscription, 'sub_link')}
                    className={`p-3.5 rounded-xl transition-all active:scale-95 ${copiedTag === 'sub' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900'}`}
                  >
                    {copiedTag === 'sub_link' ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                  </button>
                </div>
             </div>
          </div>

          {/* Individual Configs */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Zap size={14} className="text-amber-500" /> Direct Links
            </h3>
            
            {loading ? (
              <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {linksData?.links.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-5 p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 transition-all group">
                    {/* Контейнер QR с возможностью увеличения */}
                    <div 
                      className="relative bg-white p-2 rounded-xl border border-slate-100 shadow-sm cursor-zoom-in group/qr"
                      onClick={() => setZoomedQr(item.link)}
                    >
                      <QRCode value={item.link} size={70} viewBox={`0 0 256 256`} className="w-16 h-16" />
                      <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group/qr hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                        <Maximize2 size={16} className="text-indigo-600" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 uppercase">
                          {item.protocol}
                        </span>
                        <span className="text-sm font-bold text-slate-800 truncate">{item.tag}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono truncate mb-2">{item.link}</p>
                      
                      <div className="flex gap-4">
                        <button 
                          onClick={() => handleCopy(item.link, item.tag)}
                          className={`flex items-center gap-2 text-[10px] font-bold transition-colors ${copiedTag === item.tag ? 'text-emerald-500' : 'text-slate-400 hover:text-indigo-600'}`}
                        >
                          {copiedTag === item.tag ? <><CheckCircle2 size={12}/> COPIED</> : <><Copy size={12}/> COPY LINK</>}
                        </button>
                        <button 
                          onClick={() => setZoomedQr(item.link)}
                          className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <UserPlus size={12} /> ENLARGE QR
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}