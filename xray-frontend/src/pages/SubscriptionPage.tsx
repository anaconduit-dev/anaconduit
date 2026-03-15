import { useEffect, useState } from "react";
import { getSubscriptionInfo } from "../api/pub_sub";
import { useParams, useSearchParams } from "react-router-dom";
import { CLIENT_APPS } from "../constants/app";
import QRCode from "react-qr-code";

// Типизация для языка
type Lang = "ru" | "en";

// Словарь системных текстов
const UI_TEXT = {
  nodeStatus: { ru: 'Узел системы: Работает', en: 'System Node: Operational' },
  online: { ru: '● В сети', en: '● System Online' },
  offline: { ru: '● Оффлайн', en: '● System Offline' },
  usage: { ru: 'Потребление трафика', en: 'Data Consumption' },
  encrypted: { ru: 'Шифрование', en: 'Encrypted' },
  used: { ru: 'Использовано', en: 'Used Volume' },
  limit: { ru: 'Лимит', en: 'Total Limit' },
  expiration: { ru: 'Срок действия', en: 'Access Expiration' },
  premium: { ru: 'Премиум подписка', en: 'Premium Subscription' },
  guide: { ru: 'Инструкция по настройке', en: 'Configuration Guide' },
  copy: { ru: 'Копировать ссылку подписки', en: 'Copy System Subscription' },
  copied: { ru: 'Успешно скопировано', en: 'Successfully Copied' },
  forever: { ru: 'Бессрочно', en: 'Unlimited' },
  individualConnections: { ru: 'Индивидуальные подключения', en: 'Individual Connections' },
  manualImport: { ru: 'Для ручного импорта каждой ноды отдельно', en: 'For manual node import' },
  scanToImport: { ru: 'Сканируйте для импорта ноды', en: 'Scan to import node' },
  close: { ru: 'Закрыть', en: 'Close' }
};

export default function SubscriptionPage() {
  // 1. Инициализация языка
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem("app_lang");
    if (saved === "ru" || saved === "en") return saved as Lang;
    return window.navigator.language.startsWith("ru") ? "ru" : "en";
  });
  const [activeApp, setActiveApp] = useState<string>("");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeOS, setActiveOS] = useState("Android");
  const [qrModalLink, setQrModalLink] = useState<string | null>(null);
  const { token: urlToken } = useParams(); 
  const [searchParams] = useSearchParams();
  const queryToken = searchParams.get("token");
  const activeToken = urlToken || queryToken || null;

  const toggleLang = (newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem("app_lang", newLang);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return UI_TEXT.forever[lang];
    const date = new Date(dateString);
    return date.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { 
      day: "numeric", month: "long", year: "numeric" 
    });
  };

  const getFinalLink = (link: string) => {
    if (!data?.subscription_url) return link;
    return link.replace("{{SUBSCRIPTION_LINK}}", encodeURIComponent(data.subscription_url));
  };
  useEffect(() => {
    const group = CLIENT_APPS.find(g => g.os === activeOS);
    if (group && group.apps.length > 0) {
      setActiveApp(group.apps[0].name);
    }
  }, [activeOS]);
  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    if (ua.includes("win")) setActiveOS("Windows");
    else if (ua.includes("iphone") || ua.includes("ipad")) setActiveOS("iOS");
    else if (ua.includes("mac")) setActiveOS("macOS");
    else if (ua.includes("android")) setActiveOS("Android");
    else if (ua.includes("linux")) setActiveOS("Linux");
  }, []);

  useEffect(() => {
    if (activeToken) {
      setLoading(true);
      getSubscriptionInfo(activeToken)
        .then((res) => {
          setData(res);
          setError(null);
        })
        .catch(() => {
          setError(lang === 'ru' ? "Недействительный токен" : "Invalid token");
        })
        .finally(() => setLoading(false));
    }
  }, [activeToken, lang]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!activeToken) return <div className="text-white p-10 text-center">No Token Provided</div>;
  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
    </div>
  );
  // Если загрузка прошла, но есть ошибка — показываем её в стиле Orion
  if (error) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-red-500/5 border border-red-500/20 p-8 rounded-[2.5rem] space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-bold text-white uppercase">{lang === 'ru' ? 'Ошибка доступа' : 'Access Error'}</h2>
        <p className="text-sm text-red-400/80 leading-relaxed">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-6 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl transition-all"
        >
          {lang === 'ru' ? 'Попробовать снова' : 'Try Again'}
        </button>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen bg-[#050505] p-4 md:p-12 text-slate-200 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      <div className="w-full mx-auto space-y-6 md:space-y-10">
        
        {/* Header Section */}
        <div className="max-w-7xl mx-auto w-full flex justify-between items-start px-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <p className="text-indigo-400/60 text-[10px] font-black uppercase tracking-[0.2em]">
                {UI_TEXT.nodeStatus[lang]}
              </p>
            </div>
            <h1 className="text-xl md:text-3xl font-black text-white tracking-tighter italic uppercase transition-all">
              {data?.username}
            </h1>
          </div>

          <div className="flex flex-row items-center gap-3">
            {/* Language Switcher */}
            <div className="flex p-1 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md transition-all">
              {(["ru", "en"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => toggleLang(l)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                    lang === l ? "bg-white text-black shadow-lg" : "text-slate-500 hover:text-white"
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Status Badge */}
            <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${
              data?.status === 'active' 
                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.1)]' 
                : 'bg-red-500/5 border-red-500/20 text-red-400'
            }`}>
              {data?.status === 'active' ? UI_TEXT.online[lang] : UI_TEXT.offline[lang]}
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-3"> {/* Уменьшили gap с 6/4 до 3 */}
          <div className="lg:col-span-2 group relative bg-[#0A0A0A] border border-white/5 rounded-[2rem] p-5 md:p-6 shadow-2xl overflow-hidden"> 
            {/* Уменьшили скругление до 2rem и padding до p-5/p-6 */}
            
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-600/10 blur-[120px] rounded-full group-hover:bg-indigo-600/20 transition-all duration-700" />
            
            <div className="relative z-10 space-y-4"> {/* Уменьшили шаг между рядами с space-y-8 до 4 */}
              <div className="flex justify-between items-end gap-2">
                <div className="space-y-0"> {/* Убрали лишний шаг в заголовке */}
                  <span className="text-muted text-[8px] font-black uppercase tracking-[0.3em] block">{UI_TEXT.usage[lang]}</span>
                  <p className="text-3xl md:text-4xl font-black text-white tracking-tighter italic leading-tight">
                    {data?.usage_percent}<span className="text-indigo-500 text-2xl">%</span>
                  </p>
                </div>
                <div className="text-right hidden sm:block">
                  <span className="text-muted text-[8px] font-black uppercase tracking-[0.3em] block">{UI_TEXT.encrypted[lang]}</span>
                  <p className="text-base font-black text-indigo-400 tracking-widest uppercase">TLS / XRAY</p>
                </div>
              </div>

              {/* Прогресс-бар */}
              <div className="relative w-full bg-white/5 h-1.5 rounded-full overflow-hidden"> 
                {/* Уменьшили высоту бара до h-1.5 */}
                <div className="absolute top-0 left-0 h-full transition-all duration-1000 shadow-[0_0_20px_rgba(79,70,229,0.5)]"
                  style={{ width: `${data?.usage_percent || 0}%`, backgroundColor: data?.usage_percent > 90 ? '#ef4444' : '#4f46e5' }} 
                />
              </div>

              <div className="grid grid-cols-2 gap-3"> {/* Уменьшили gap между карточками трафика до 3 */}
                <div className="bg-white/[0.02] border border-white/5 p-4 rounded-[1.5rem]"> 
                  {/* Уменьшили padding внутри ячеек до p-4 и скругление до 1.5rem */}
                  <p className="text-[8px] text-muted font-black uppercase tracking-widest mb-1">{UI_TEXT.used[lang]}</p>
                  <p className="text-lg md:text-xl font-black text-white leading-none">{data?.used_traffic_gb} <span className="text-[10px] text-muted font-normal uppercase">GB</span></p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 p-4 rounded-[1.5rem]">
                  <p className="text-[8px] text-muted font-black uppercase tracking-widest mb-1">{UI_TEXT.limit[lang]}</p>
                  <p className="text-lg md:text-xl font-black text-white leading-none">{data?.total_traffic_gb || "∞"} <span className="text-[10px] text-muted font-normal uppercase">GB</span></p>
                </div>
              </div>
            </div>
          </div>

          {/* Карточка срока действия */}
          <div className="lg:col-span-1 h-full bg-indigo-950/40 border border-indigo-500/20 rounded-[2rem] p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col justify-center">
            {/* Сделали фон темнее (indigo-950/40), чтобы не спорил с основной карточкой, и уменьшили padding до p-6 */}
            <div className="relative z-10">
              <span className="text-indigo-200/60 text-[8px] font-black uppercase tracking-[0.3em] block mb-2">{UI_TEXT.expiration[lang]}</span>
              <p className="text-2xl md:text-3xl font-black text-white leading-tight tracking-tighter uppercase">{formatDate(data?.expire_date)}</p>
            </div>
          </div>
        </div>

       {/* Setup Section */}
        <div className="max-w-7xl mx-auto w-full bg-[#0A0A0A] border border-white/5 rounded-[3rem] p-3 shadow-lg transition-all">
          <div className="p-8 pb-4">
            <h3 className="text-xl font-black text-white uppercase tracking-tight">{UI_TEXT.guide[lang]}</h3>
          </div>
          
          {/* РЯД 1: Выбор ОС */}
          <div className="relative mx-4 mb-4">
            <div className="flex gap-2 p-2 bg-black/40 rounded-[2rem] overflow-x-auto scrollbar-custom border border-white/5">
              {CLIENT_APPS.map((group) => (
                <button
                  key={group.os}
                  onClick={() => setActiveOS(group.os)}
                  className={`flex-1 flex items-center justify-center gap-3 px-8 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${
                    activeOS === group.os 
                      ? 'bg-white text-black shadow-xl scale-[1.02]' 
                      : 'text-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="text-xl">{group.icon}</span> 
                  <span>{group.os}</span>
                </button>
              ))}
            </div>
          </div>

          {/* РЯД 2: Выбор конкретного Приложения (App Selector) */}
          <div className="relative mx-4 mb-8">
            <div className="flex gap-2 p-1.5 bg-white/[0.02] rounded-[1.8rem] overflow-x-auto scrollbar-custom border border-white/5">
              {CLIENT_APPS.find(g => g.os === activeOS)?.apps.map((app) => (
                <button
                  key={app.name}
                  onClick={() => setActiveApp(app.name)}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-[1.2rem] text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                    activeApp === app.name 
                      ? 'bg-indigo-900 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]' 
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <span className="text-lg">{app.icon}</span>
                  <span>{app.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* КОНТЕНТ: Отображаем блоки только выбранного приложения */}
          <div className="p-4 pt-0">
            {CLIENT_APPS.find(g => g.os === activeOS)?.apps
              .filter(app => app.name === activeApp)
              .map((app) => (
                <div key={app.name} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {app.blocks.map((block, idx) => (
                      <div 
                        key={idx} 
                        className="bg-white/[0.03] border border-white/[0.08] rounded-[2.5rem] p-8 hover:border-indigo-500/30 transition-all flex flex-col h-full group"
                      >
                        <div className="flex gap-6">
                          <div className="w-14 h-14 shrink-0 bg-white/5 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform duration-500">
                            {block.icon}
                          </div>
                          <div className="space-y-4 w-full">
                            <div>
                              <h4 className="font-black text-white text-xs uppercase tracking-[0.2em] mb-2">
                                {block.title[lang]}
                              </h4>
                              <p className="text-sm text-slate-400 leading-relaxed italic">
                                {block.description[lang]}
                              </p>
                            </div>
                            
                            {block.buttons && block.buttons.length > 0 && (
                              <div className="flex flex-wrap gap-3 pt-4 border-t border-white/5">
                                {block.buttons.map((btn, bIdx) => (
                                  <button
                                    key={bIdx}
                                    onClick={() => {
                                      if (btn.type === "subscriptionLink") window.location.href = getFinalLink(btn.link);
                                      else window.open(btn.link, "_blank");
                                    }}
                                    className="px-5 py-3 bg-white text-black hover:bg-indigo-500 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
                                  >
                                    {btn.text[lang]}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Floating Action Bar */}
        <div className="sticky bottom-8 z-30 flex justify-center px-4">
          <button 
            onClick={() => copyToClipboard(data?.subscription_url)}
            className={`w-full max-w-md font-black py-6 rounded-full transition-all duration-500 shadow-2xl flex items-center justify-center gap-4 group active:scale-[0.96] overflow-hidden ${
                copied ? 'bg-emerald-600 text-white' : 'bg-white text-black hover:bg-indigo-600 hover:text-white'
            }`}
          >
            <span className="uppercase tracking-[0.3em] text-[12px]">
              {copied ? UI_TEXT.copied[lang] : UI_TEXT.copy[lang]}
            </span>
          </button>
        </div>
        {/* Individual Links Section */}
        {data?.links && data.links.length > 0 && (
          <div className="max-w-7xl mx-auto w-full space-y-6 mt-10">
            <div className="px-8">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">
                {UI_TEXT.individualConnections[lang]}
              </h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mt-2">
                {UI_TEXT.manualImport[lang]}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
              {data.links.map((linkItem: any, idx: number) => (
                <div 
                  key={idx} 
                  className="bg-[#0A0A0A] border border-white/5 rounded-[2.5rem] p-6 flex items-center justify-between group hover:border-indigo-500/30 transition-all shadow-xl"
                >
                  <div className="flex items-center gap-5 overflow-hidden">
                    {/* Мини QR-код (превью) */}
                    <div 
                      className="p-3 bg-white rounded-[1.5rem] cursor-pointer hover:scale-105 transition-transform shrink-0 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                      onClick={() => setQrModalLink(linkItem.link)}
                    >
                      <div style={{ height: "auto", margin: "0 auto", maxWidth: 44, width: "100%" }}>
                        <QRCode
                          size={256}
                          style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                          value={linkItem.link}
                          viewBox={`0 0 256 256`}
                        />
                      </div>
                    </div>
                    
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-md border ${
                          linkItem.protocol === 'vless' 
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {linkItem.protocol}
                        </span>
                        <h4 className="text-sm font-bold text-white tracking-tight truncate uppercase italic">
                          {linkItem.tag}
                        </h4>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono truncate opacity-50">
                        {linkItem.link}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => copyToClipboard(linkItem.link)}
                      className="p-4 bg-white/5 hover:bg-white text-slate-400 hover:text-black rounded-2xl transition-all active:scale-90"
                      title={lang === 'ru' ? 'Копировать' : 'Copy'}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal для QR-кода */}
        {qrModalLink && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300"
            onClick={() => setQrModalLink(null)}
          >
            <div 
              className="bg-white p-10 rounded-[3.5rem] shadow-[0_0_60px_rgba(79,70,229,0.5)] flex flex-col items-center space-y-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white p-2">
                <QRCode 
                  value={qrModalLink} 
                  size={220}
                  viewBox={`0 0 256 256`}
                />
              </div>
              {/* Внутри модалки */}
                <div className="text-center space-y-2">
                  <p className="text-black text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
                    {UI_TEXT.scanToImport[lang]}
                  </p>
                  <button 
                    onClick={() => setQrModalLink(null)}
                    className="w-full px-8 py-4 bg-black text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl active:scale-95 transition-all"
                  >
                    {UI_TEXT.close[lang]}
                  </button>
                </div>
            </div>
          </div>
        )}
        <footer className="text-center pb-12 opacity-20">
          <p className="text-[10px] font-black uppercase tracking-[0.5em]">Anaconduit Managed Node • 2026</p>
        </footer>
      </div>
    </div>
  );
}