import { useState, useEffect } from "react";
import { 
  X, Shield, Zap, Loader2, Search, Globe,
  Settings, RefreshCcw, AlertTriangle, AlertCircle
} from "lucide-react";
import { updateInbound, getInboundById } from "../api/inbound";
import { generateXrayKeys } from "../api/user";

const generateComplexPath = () => {
  const randomNum = Math.floor(Math.random() * 90000) + 10000; // 5 цифр
  const randomStr = Math.random().toString(36).substring(2, 12); // 10 символов
  return `/${randomNum}/${randomStr}`;
};

const generateShortId = (length = 8) => {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};


const grpcServices = [
  "SpeechService", "Analytics", "Tunnel", "Internal", "Cloud", 
  "Health", "Data", "Mesh", "Bridge", "Secure", "Node", "Proxy", "Core"
];
const getRandomGrpcService = () => {
  const prefix = grpcServices[Math.floor(Math.random() * grpcServices.length)];
  const subService = grpcServices[Math.floor(Math.random() * grpcServices.length)];
  const version = `v${Math.floor(Math.random() * 3) + 1}`; 
  const randomId = Math.random().toString(36).slice(2, 7).toUpperCase();
  
  // Пример результата: /v2/Secure.Node/8831/API.X6F2K
  return `/${version}/${prefix}.${subService}/${Math.floor(Math.random() * 9000 + 1000)}/API.${randomId}`;
};

const mapInboundToForm = (inbound: any) => {
  const s = inbound.stream_settings || {};
  const ins = inbound.settings || {};
  const sn = inbound.sniffing || {};
  const sock = s.sockopt || {};
  
  

  const proxyVal = s.tcpSettings?.acceptProxyProtocol || s.wsSettings?.acceptProxyProtocol || false;
  
  return {
    tag: inbound.tag || "",
    port: inbound.port,
    listen: inbound.listen || "0.0.0.0",
    protocol: (inbound.protocol || "vless").toLowerCase(),
    flow: ins.flow || "",
    decryption: ins.decryption || "none",
    fallbackDest: ins.fallbacks?.[0]?.dest?.toString() || "80",
    network: s.network === "tcp" ? "raw" : s.network,
    security: s.security || "none",
    show: s.realitySettings?.show || false,
    dest: s.realitySettings?.dest || "",
    xver: s.realitySettings?.xver || 0,
    serverNames: s.realitySettings?.serverNames?.join(", ") || "",
    privateKey: s.realitySettings?.privateKey || "",
    publicKey: s.realitySettings?.publicKey || "", 
    shortIds: s.realitySettings?.shortIds?.join(", ") || "",
    fingerprint: s.realitySettings?.fingerprint || "chrome",
    spiderX: s.realitySettings?.spiderX || "/",
    maxTimediff: s.realitySettings?.maxTimediff || 0,
    tlsServerName: s.tlsSettings?.serverName || "",
    alpn: s.tlsSettings?.alpn?.join(", ") || "h2, http/1.1",
    allowInsecure: s.tlsSettings?.allowInsecure || false,
    tlsCertPath: s.tlsSettings?.certificates?.[0]?.certificateFile || "",
    tlsKeyPath: s.tlsSettings?.certificates?.[0]?.keyFile || "",
    sniffingEnabled: sn.enabled ?? true,
    destOverride: sn.destOverride?.join(", ") || "http, tls, quic, fakedns",
    metadataOnly: sn.metadataOnly || false,
    domainsExcluded: sn.domainsExcluded?.join(", ") || "",
    routeOnly: sn.routeOnly || false,
    enableSockopt: !!s.sockopt,
    tcpFastOpen: sock.tcpFastOpen ?? true,
    noDelay: sock.tcpNoDelay ?? true,
    tcpCongestion: sock.tcpcongestion || "bbr",
    mptcp: sock.tcpMptcp || false,
    mark: sock.mark || 0,
    tproxy: sock.tproxy || "off",
    tcpMaxSeg: sock.tcpMaxSeg || 1440,
    domainStrategy: sock.domainStrategy || "UseIP",
    tcpKeepAliveIdle: sock.tcpKeepAliveIdle || 300,
    tcpUserTimeout: sock.tcpUserTimeout || 10000,
    acceptProxyProtocol: proxyVal || false,
    wsPath: s.wsSettings?.path || "/",
    wsHost: s.wsSettings?.host || "",
    grpcServiceName: s.grpcSettings?.serviceName || "",
    grpcAuthority: s.grpcSettings?.authority || "",
    grpcMultiMode: s.grpcSettings?.multiMode || false,
    xhttpPath: s.xhttpSettings?.path || "/",
    xhttpMode: s.xhttpMode || "stream-up",
    xhttpPadding: s.xhttpSettings?.extra?.padding || "100-1000",
    tcpHeaderType: s.tcpSettings?.header?.type || "none",
    httpHost: s.tcpSettings?.header?.request?.headers?.Host?.[0] || "www.bing.com",
    httpPath: s.tcpSettings?.header?.request?.path?.[0] || "/",
  };
};

export default function EditInboundModal({ isOpen, onClose, onSuccess, inboundId }: any) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [activeTab, setActiveTab] = useState('base');
  const [form, setForm] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (isOpen && inboundId) {
        setFetching(true);
        setError(null);
        try {
          const res = await getInboundById(inboundId);
          if (isMounted) setForm(mapInboundToForm(res.data));
        } catch (err: any) {
          if (isMounted) setError("Ошибка загрузки данных инбаунда");
        } finally {
          if (isMounted) setFetching(false);
        }
      }
    };

    loadData();
    return () => { 
      isMounted = false; 
      setForm(null); // Важно: очищаем при размонтировании
    };
  }, [isOpen, inboundId]);
  

  if (!isOpen) return null;

  const handleGenerateKeys = async () => {
    try {
        const keys = await generateXrayKeys();
        setForm((prev: any) => ({ 
        ...prev, 
        privateKey: keys.private_key, 
        publicKey: keys.public_key 
        }));
    } catch (e) { 
        console.error(e); 
    }
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setLoading(true);

    
    const payload = {
      tag: form.tag,
      protocol: form.protocol,
      port: form.port,
      listen: form.listen,
      settings: {
        decryption: form.decryption,
        flow: form.flow,
        fallbacks: form.network === "grpc" ? [] : [
            { 
                dest: String(form.fallbackDest), 
                xver: 0 
            }
            ]
      },
      stream_settings: {
        network: form.network === "raw" ? "tcp" : form.network,
        security: form.security,
        tcpSettings: form.network === "raw" ? {
          acceptProxyProtocol: form.acceptProxyProtocol,
          header: {
            type: form.security === 'reality' ? "none" : form.tcpHeaderType,
            ...(form.tcpHeaderType === "http" && form.security !== 'reality' ? {
              request: {
                version: "1.1", method: "GET", path: [form.httpPath],
                headers: { "Host": [form.httpHost] }
              }
            } : {})
          }
        } : undefined,
        wsSettings: form.network === "ws" ? {
          acceptProxyProtocol: form.acceptProxyProtocol,
          path: form.wsPath, host: form.wsHost,
          headers: form.wsHost ? { "Host": form.wsHost } : {}
        } : undefined,
        grpcSettings: form.network === "grpc" ? {
          serviceName: form.grpcServiceName,
          multiMode: form.grpcMultiMode,
          authority: form.grpcAuthority || undefined
        } : undefined,
        realitySettings: form.security === "reality" ? {
          show: form.show, dest: form.dest, xver: form.xver,
          serverNames: form.serverNames.split(",").map((s:any) => s.trim()).filter(Boolean),
          privateKey: form.privateKey, publicKey: form.publicKey,
          shortIds: form.shortIds.split(",").map((s:any) => s.trim()).filter(Boolean),
          maxTimediff: form.maxTimediff || 0,
          fingerprint: form.fingerprint, spiderX: form.spiderX,
        } : undefined,
        xhttpSettings: form.network === "xhttp" ? {
            path: form.xhttpPath,
            mode: form.xhttpMode,
            extra: {
                padding: form.xhttpPadding
            }
            } : undefined,
        ...(form.enableSockopt && {
          sockopt: {
            tcpFastOpen: form.tcpFastOpen,
            tcpNoDelay: form.noDelay,
            tcpcongestion: form.tcpCongestion, // ПИШЕМ С МАЛЕНЬКОЙ БУКВЫ "c"
            tcpMptcp: form.mptcp,
            mark: form.mark || 0,
            tproxy: form.tproxy || "off",
            tcpMaxSeg: Number(form.tcpMaxSeg),
            domainStrategy: form.domainStrategy,
            tcpKeepAliveIdle: Number(form.tcpKeepAliveIdle),
            tcpUserTimeout: Number(form.tcpUserTimeout),
            acceptProxyProtocol: form.acceptProxyProtocol
          }
        })
      },
      sniffing: {
        enabled: form.sniffingEnabled,
        destOverride: form.destOverride.split(",").map((s:any) => s.trim()),
        metadataOnly: form.metadataOnly,
        domainsExcluded: form.domainsExcluded.split(",").map((s:any) => s.trim()),
        routeOnly: form.routeOnly
      }
    };
    
    try {
      await updateInbound(inboundId, payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert("Ошибка: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505]/90 backdrop-blur-xl p-4">
        <div className="bg-main w-full max-w-5xl rounded-[3rem] border border-line shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-[90vh]">
            
            {/* Header */}
            <div className="p-8 bg-card/30 border-b border-line flex justify-between items-center relative overflow-hidden">
            <div className="flex items-center gap-5 relative z-10">
                <div className="p-4 bg-amber-500 rounded-[1.5rem] text-white shadow-lg shadow-amber-900/20">
                <RefreshCcw size={24} className={fetching ? "animate-spin" : ""} />
                </div>
                <div>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-base">
                    Inbound Config<span className="text-amber-500">.</span>
                </h2>
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] opacity-80">
                    Редактирование параметров ядра
                </p>
                </div>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-red-500/10 hover:text-red-500 text-muted rounded-2xl transition-all active:scale-90 border border-transparent hover:border-red-500/20">
                <X size={24} />
            </button>
            </div>

            {fetching ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 bg-main">
                <Loader2 size={48} className="animate-spin text-indigo-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted">Синхронизация JSON...</span>
            </div>
            ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-red-500 p-10 text-center bg-main">
                <AlertCircle size={64} />
                <span className="text-sm font-black uppercase tracking-tight">{error}</span>
                <button onClick={onClose} className="px-8 py-4 bg-card border border-line rounded-2xl text-muted font-bold uppercase text-xs hover:text-base transition-colors">Закрыть</button>
            </div>
            ) : !form ? null : (
            <>
                {/* Tabs */}
                <div className="flex px-10 py-5 gap-3 bg-card/10 border-b border-line overflow-x-auto no-scrollbar shadow-inner">
                {[
                    { id: 'base', label: 'База', icon: Zap },
                    { id: 'transport', label: 'Транспорт', icon: Globe },
                    { id: 'security', label: 'Шифрование', icon: Shield },
                    { id: 'sniffing', label: 'Сниффинг', icon: Search },
                    { id: 'sockopt', label: 'Сокеты', icon: Settings },
                ].map(tab => (
                    <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 px-8 py-4 rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest transition-all shrink-0 border ${
                        activeTab === tab.id 
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-900/40 translate-y-[-2px]' 
                        : 'bg-main border-line text-muted hover:border-indigo-500/30'
                    }`}
                    >
                    <tab.icon size={14} /> {tab.label}
                    </button>
                ))}
                </div>

                <form id="edit-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar bg-main/50">
                
                {activeTab === 'base' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Warning Alert */}
                    <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-[2rem] flex gap-5 items-start shadow-inner">
                        <AlertTriangle className="text-amber-500 shrink-0" size={24} />
                        <p className="text-[11px] text-muted font-medium leading-relaxed">
                        <b className="text-amber-500 uppercase font-black tracking-wider">Внимание:</b> Изменение порта, протокола или ключей Reality приведет к неработоспособности старых ссылок у клиентов.
                        </p>
                    </div>

                    {/* Grid Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-2">Tag</label>
                        <input required className="w-full p-5 bg-card border border-line rounded-[1.5rem] font-black text-sm text-base focus:border-indigo-500/50 outline-none transition-all shadow-xl" value={form?.tag || ""} onChange={e => setForm({...form, tag: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-2">Порт</label>
                        <input type="number" className="w-full p-5 bg-card border border-line rounded-[1.5rem] font-mono font-black text-sm text-indigo-400 focus:border-indigo-500/50 outline-none transition-all shadow-xl" value={form?.port || 0} onChange={e => setForm({...form, port: parseInt(e.target.value)})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-2">IP прослушивания</label>
                            <input className="w-full p-5 bg-card border border-line rounded-[1.5rem] font-mono text-sm text-base focus:border-indigo-500 transition-all outline-none shadow-xl" value={form.listen} onChange={e => setForm({...form, listen: e.target.value})} />
                        </div>

                        <div className="md:col-span-3 py-4">
                            <div className="h-[1px] bg-gradient-to-r from-transparent via-line to-transparent w-full" />
                        </div>

                        {/* Protocol Buttons Selector */}
                        <div className="space-y-4 md:col-span-3">
                            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-2">Выбор протокола</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {['vless', 'trojan', 'shadowsocks', 'vmess'].map((proto) => {
                                const isLocked = proto === 'shadowsocks' || proto === 'vmess';
                                const isActive = form.protocol === proto;

                                return (
                                    <button
                                    key={proto}
                                    type="button"
                                    disabled={isLocked}
                                    onClick={() => setForm({ ...form, protocol: proto })}
                                    className={`relative py-6 rounded-[2rem] font-black text-[11px] uppercase tracking-widest transition-all border group ${
                                        isActive 
                                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-2xl shadow-indigo-900/50 scale-105 z-10' 
                                        : 'bg-card text-muted border-line hover:border-indigo-500/40 hover:text-base'
                                    } ${isLocked ? 'opacity-20 cursor-not-allowed grayscale' : 'active:scale-95'}`}
                                    >
                                    {proto}
                                    {isLocked && (
                                        <div className="absolute top-2 right-2 px-2 py-0.5 bg-main rounded-md border border-line text-[6px] font-black">
                                            SOON
                                        </div>
                                    )}
                                    </button>
                                );
                                })}
                            </div>
                        </div>
                    </div>
                    
                    {/* Specific Settings (Flow / Fallback) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                        {form.protocol === 'vless' && (
                            <div className="space-y-2 animate-in slide-in-from-top-4 duration-500">
                                <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-2">Default Flow</label>
                                <select 
                                    className="w-full p-5 bg-card border border-line rounded-[1.5rem] font-black text-sm text-indigo-400 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all appearance-none cursor-pointer"
                                    value={form.flow || ""} 
                                    onChange={e => setForm({...form, flow: e.target.value})}
                                >
                                    <option value="xtls-rprx-vision">XTLS Vision (Best)</option>
                                    <option value="">None (Legacy)</option>
                                </select>
                            </div>
                        )}

                        <div className={`space-y-2 ${form.protocol !== 'vless' ? 'md:col-span-2' : ''}`}>
                            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-2 flex justify-between items-center">
                                <span>Fallback Dest (HTTP)</span>
                                {form.network === 'grpc' && (
                                    <span className="text-amber-500 font-black animate-pulse text-[8px] bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">Incompatible with gRPC</span>
                                )}
                            </label>
                            <input 
                            disabled={form.network === 'grpc'}
                            className={`w-full p-5 border rounded-[1.5rem] font-black text-sm transition-all outline-none shadow-xl ${
                                form.network === 'grpc' 
                                ? 'bg-main text-muted border-line cursor-not-allowed opacity-30' 
                                : 'bg-card border-line text-base focus:border-indigo-500/50'
                            }`}
                            value={form.network === 'grpc' ? "" : (form.fallbackDest || "")} 
                            onChange={e => setForm({...form, fallbackDest: e.target.value})}
                            placeholder="80 или 127.0.0.1:8080"
                            />
                        </div>
                    </div>
                    </div>
                )}

                {/* TAB: TRANSPORT */}
                {activeTab === 'transport' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        
                        {/* ВЫБОР ТИПА СЕТИ (Network Type) */}
                        <div className="space-y-4">
                        <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-2">
                            Тип транспортного протокола
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {['raw', 'ws', 'grpc', 'xhttp'].map((net) => {
                            const isDisabled = form.security === 'reality' && net === 'ws';
                            const isActive = form.network === net;
                            
                            return (
                                <button
                                key={net}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => setForm({ ...form, network: net })}
                                className={`relative py-6 rounded-[2rem] font-black text-[11px] uppercase tracking-widest transition-all border group ${
                                    isActive 
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl shadow-indigo-900/40 translate-y-[-2px]' 
                                    : 'bg-card border-line text-muted hover:border-indigo-500/30'
                                } ${isDisabled ? 'opacity-20 cursor-not-allowed grayscale' : 'active:scale-95'}`}
                                >
                                {net === 'raw' ? 'TCP / RAW' : net.toUpperCase()}
                                {isDisabled && (
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[7px] font-black px-2 py-0.5 rounded shadow-lg whitespace-nowrap">
                                    NOT FOR REALITY
                                    </div>
                                )}
                                </button>
                            );
                            })}
                        </div>
                        </div>

                        <div className="py-2">
                        <div className="h-[1px] bg-gradient-to-r from-transparent via-line to-transparent w-full" />
                        </div>

                        {/* Настройки для RAW (TCP/RAW) */}
                        {form.network === 'raw' && (
                        <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                            
                            {/* Proxy Protocol Switch */}
                            <div className="flex items-center justify-between p-6 bg-card border border-line rounded-[2rem] shadow-xl">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-black text-base uppercase tracking-tight">Accept Proxy Protocol</h4>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${form.acceptProxyProtocol ? "bg-emerald-500 animate-pulse" : "bg-muted"}`} />
                                        <p className="text-[9px] text-muted uppercase font-black tracking-widest">
                                        Status: <span className={form.acceptProxyProtocol ? "text-emerald-500" : "text-muted"}>
                                            {form.acceptProxyProtocol ? "Enabled" : "Disabled"}
                                        </span>
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setForm({...form, acceptProxyProtocol: !form.acceptProxyProtocol})}
                                    className={`w-14 h-7 rounded-full transition-all relative border ${form.acceptProxyProtocol ? 'bg-indigo-600 border-indigo-400' : 'bg-main border-line'}`}
                                >
                                    <div className={`absolute top-1 left-1 bg-white w-4.5 h-4.5 rounded-full shadow-lg transition-transform duration-300 ${form.acceptProxyProtocol ? 'translate-x-7' : ''}`} />
                                </button>
                            </div>

                            {/* Header Type */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-2 flex justify-between">
                                    Тип маскировки (Header Type)
                                    {form.security === 'reality' && (
                                        <span className="text-amber-500 font-black text-[8px] tracking-widest bg-amber-500/10 px-2 py-1 rounded-lg">REALITY LOCK: NONE</span>
                                    )}
                                </label>
                                <div className="relative">
                                    <select 
                                        disabled={form.security === 'reality'}
                                        className={`w-full p-5 rounded-[1.5rem] font-black text-sm border transition-all outline-none appearance-none cursor-pointer ${
                                            form.security === 'reality' 
                                            ? 'bg-main text-muted border-line opacity-50 cursor-not-allowed' 
                                            : 'bg-card text-indigo-400 border-line focus:border-indigo-500/50'
                                        }`}
                                        value={form.security === 'reality' ? 'none' : (form.tcpHeaderType || 'none')}
                                        onChange={e => setForm({...form, tcpHeaderType: e.target.value})}
                                    >
                                        <option value="none">None (Без маскировки)</option>
                                        <option value="http">HTTP (Camouflage)</option>
                                    </select>
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                                    <Search size={16} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        )}

                        {/* Настройки для WebSocket (WS) */}
                        {form.network === 'ws' && (
                        <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-2 flex justify-between items-center">
                                    WS Path
                                    <button 
                                        type="button"
                                        onClick={() => setForm({...form, wsPath: generateComplexPath()})}
                                        className="text-[8px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 px-3 py-1 rounded-full border border-indigo-500/20 transition-all uppercase"
                                    >
                                        Generate path
                                    </button>
                                </label>
                                <div className="relative">
                                    <input 
                                        className="w-full p-5 bg-card border border-line rounded-[1.5rem] font-mono text-sm text-base pr-12 focus:border-indigo-500/50 outline-none transition-all shadow-xl" 
                                        value={form.wsPath} 
                                        onChange={e => setForm({...form, wsPath: e.target.value})} 
                                        placeholder="/secret-path" 
                                    />
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-muted/30">
                                        <Zap size={18} /> 
                                    </div>
                                </div>
                                </div>

                                <div className="space-y-2">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-2">WS Host (SNI)</label>
                                <div className="relative">
                                    <input 
                                        className="w-full p-5 bg-card border border-line rounded-[1.5rem] font-mono text-sm text-base pr-12 focus:border-indigo-500/50 outline-none transition-all shadow-xl" 
                                        value={form.wsHost} 
                                        onChange={e => setForm({...form, wsHost: e.target.value})} 
                                        placeholder="example.com" 
                                    />
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-muted/30">
                                        <Globe size={18} />
                                    </div>
                                </div>
                                </div>
                            </div>
                        </div>
                        )}

                        {/* gRPC Settings */}
                        {form.network === 'grpc' && (
                        <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                <label className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] ml-2">Service Name</label>
                                <div className="relative">
                                    <input 
                                        className="w-full p-5 bg-card border border-line rounded-[1.5rem] font-mono text-sm text-emerald-400 pr-12 focus:border-emerald-500/50 outline-none transition-all shadow-xl" 
                                        value={form.grpcServiceName} 
                                        onChange={e => setForm({...form, grpcServiceName: e.target.value})} 
                                        placeholder="SpeechService" 
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setForm({...form, grpcServiceName: getRandomGrpcService()})}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-emerald-500/50 hover:text-emerald-500 transition-colors"
                                    >
                                        <RefreshCcw size={16} />
                                    </button>
                                </div>
                                </div>

                                <div className="space-y-2">
                                <label className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] ml-2">Authority</label>
                                <input 
                                    className="w-full p-5 bg-card border border-line rounded-[1.5rem] font-mono text-sm text-base outline-none focus:border-emerald-500/50 transition-all shadow-xl" 
                                    value={form.grpcAuthority} 
                                    onChange={e => setForm({...form, grpcAuthority: e.target.value})} 
                                    placeholder="google.com" 
                                />
                                </div>

                                <div className="flex items-center justify-between p-5 bg-card border border-line rounded-[1.5rem] shadow-xl">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase text-base tracking-tighter">Multi Mode</span>
                                    <span className="text-[8px] text-muted font-bold uppercase tracking-widest">Multiple Services</span>
                                </div>
                                <input 
                                    type="checkbox" 
                                    className="w-6 h-6 rounded-lg border-line bg-main text-indigo-600 focus:ring-offset-main accent-indigo-500"
                                    checked={form.grpcMultiMode}
                                    onChange={e => setForm({...form, grpcMultiMode: e.target.checked})}
                                />
                                </div>
                            </div>
                        </div>
                        )}

                        {/* xHttp Settings */}
                        {form.network === 'xhttp' && (
                        <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-2">Path</label>
                                <input 
                                    className="w-full p-5 bg-card border border-line rounded-[1.5rem] font-mono text-sm text-base outline-none focus:border-indigo-500/50 transition-all shadow-xl" 
                                    value={form.xhttpPath} 
                                    onChange={e => setForm({...form, xhttpPath: e.target.value})} 
                                    placeholder="/WqGYA8..." 
                                />
                                </div>

                                <div className="space-y-2">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-2">Mode</label>
                                <div className="relative">
                                    <select 
                                        className="w-full p-5 bg-card border border-line rounded-[1.5rem] font-black text-sm text-indigo-400 outline-none focus:border-indigo-500/50 transition-all appearance-none cursor-pointer"
                                        value={form.xhttpMode}
                                        onChange={e => setForm({...form, xhttpMode: e.target.value})}
                                    >
                                        <option value="stream-up">Stream Up (Fast)</option>
                                        <option value="packet-up">Packet Up (Stealth)</option>
                                    </select>
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                                    <Settings size={16} />
                                    </div>
                                </div>
                                </div>

                                <div className="space-y-2">
                                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-2">Padding Bytes</label>
                                <input 
                                    className="w-full p-5 bg-card border border-line rounded-[1.5rem] font-mono text-sm text-base outline-none focus:border-indigo-500/50 transition-all shadow-xl" 
                                    value={form.xhttpPadding} 
                                    onChange={e => setForm({...form, xhttpPadding: e.target.value})} 
                                    placeholder="100-1000" 
                                />
                                </div>
                            </div>
                            <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                            <p className="text-[9px] text-muted font-black uppercase tracking-[0.1em] text-center">
                                * xHTTP — это высокопроизводительный транспорт следующего поколения.
                            </p>
                            </div>
                        </div>
                        )}
                        
                    </div>
                    )}

              {/* TAB: SECURITY (REALITY/TLS) */}
              {activeTab === 'security' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* Encryption Selector */}
                    <div className="space-y-4">
                    <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-2">Метод шифрования</label>
                    <div className="grid grid-cols-3 gap-4">
                        {['none', 'tls', 'reality'].map((sec) => {
                        const isForbidden = form.network === 'ws' && sec === 'reality';
                        const isActive = form.security === sec;

                        return (
                            <button
                            key={sec}
                            type="button"
                            disabled={isForbidden}
                            onClick={() => setForm({ ...form, security: sec })}
                            className={`relative p-6 rounded-[2rem] font-black text-[11px] uppercase tracking-widest transition-all border group ${
                                isActive 
                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl shadow-indigo-900/40 translate-y-[-2px]' 
                                : 'bg-card border-line text-muted hover:border-indigo-500/30'
                            } ${isForbidden ? 'opacity-20 cursor-not-allowed grayscale' : 'active:scale-95'}`}
                            >
                            {sec}
                            {isForbidden && (
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[7px] font-black px-2 py-0.5 rounded shadow-lg whitespace-nowrap">
                                WS LACKS REALITY
                                </div>
                            )}
                            </button>
                        );
                        })}
                    </div>
                    </div>

                    {/* БЛОК: NONE */}
                    {form.security === 'none' && (
                    <div className="p-10 border-2 border-dashed border-line rounded-[3rem] text-center bg-card/10 group hover:border-indigo-500/20 transition-colors">
                        <div className="p-4 bg-line rounded-full w-fit mx-auto mb-4 text-muted group-hover:text-indigo-500 transition-colors">
                        <Shield size={32} />
                        </div>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
                        Трафик передается <span className="text-amber-500">без шифрования</span>. Используйте только для локальных сетей или за Nginx.
                        </p>
                    </div>
                    )}
                    
                    {/* БЛОК: TLS */}
                    {form.security === 'tls' && (
                    <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-2">Server Name (SNI)</label>
                            <input className="w-full p-5 bg-card border border-line rounded-[1.5rem] font-black text-sm text-base focus:border-indigo-500/50 outline-none transition-all shadow-xl" 
                            value={form.tlsServerName} 
                            onChange={e => setForm({...form, tlsServerName: e.target.value})} 
                            placeholder="example.com" 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-2">ALPN</label>
                            <input className="w-full p-5 bg-card border border-line rounded-[1.5rem] font-mono text-sm text-indigo-400 focus:border-indigo-500/50 outline-none transition-all shadow-xl" 
                            value={form.alpn} 
                            onChange={e => setForm({...form, alpn: e.target.value})} 
                            placeholder="h2,http/1.1" 
                            />
                        </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-2">Cert Path (.crt / .pem)</label>
                            <input className="w-full p-5 bg-main border border-line rounded-[1.5rem] font-mono text-xs text-muted focus:text-base focus:border-indigo-500 transition-all outline-none" 
                            value={form.tlsCertPath} 
                            onChange={e => setForm({...form, tlsCertPath: e.target.value})} 
                            placeholder="/etc/xray/fullchain.pem" 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-2">Key Path (.key)</label>
                            <input className="w-full p-5 bg-main border border-line rounded-[1.5rem] font-mono text-xs text-muted focus:text-base focus:border-indigo-500 transition-all outline-none" 
                            value={form.tlsKeyPath} 
                            onChange={e => setForm({...form, tlsKeyPath: e.target.value})} 
                            placeholder="/etc/xray/privkey.pem" 
                            />
                        </div>
                        </div>

                        <div className="flex items-center justify-between p-6 bg-card border border-line rounded-[2rem] shadow-xl">
                        <div className="space-y-1">
                            <h4 className="text-sm font-black text-base uppercase tracking-tight">Allow Insecure</h4>
                            <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Ignore certificate validation errors</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setForm({...form, allowInsecure: !form.allowInsecure})}
                            className={`w-14 h-7 rounded-full transition-all relative border ${form.allowInsecure ? 'bg-indigo-600 border-indigo-400' : 'bg-main border-line'}`}
                        >
                            <div className={`absolute top-1 left-1 bg-white w-4.5 h-4.5 rounded-full shadow-lg transition-transform duration-300 ${form.allowInsecure ? 'translate-x-7' : ''}`} />
                        </button>
                        </div>
                    </div>
                    )}

                    {/* БЛОК: REALITY */}
                    {form.security === 'reality' && (
                    <div className="space-y-8 bg-indigo-500/5 p-8 rounded-[3rem] border border-indigo-500/10 animate-in slide-in-from-top-4 duration-500">
                        <div className="flex justify-between items-center border-b border-indigo-500/10 pb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            <span className="font-black text-base text-[12px] uppercase tracking-[0.3em]">Reality Core Engine</span>
                        </div>
                        </div>

                        {/* Targets */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-2">Target Dest</label>
                            <input className="w-full p-5 bg-card border border-indigo-500/20 rounded-[1.5rem] text-sm font-black text-base focus:border-indigo-500 transition-all shadow-2xl" 
                            placeholder="example.com:443" 
                            value={form.dest} 
                            onChange={e => {
                                const val = e.target.value;
                                const cleanDomain = val.replace(/^https?:\/\//, '').split(':')[0];
                                let newServerNames = form.serverNames;
                                if (cleanDomain.includes('.')) {
                                    const baseDomain = cleanDomain.startsWith('www.') ? cleanDomain.substring(4) : cleanDomain;
                                    newServerNames = `www.${baseDomain}, ${baseDomain}`;
                                }
                                setForm({...form, dest: val, serverNames: newServerNames});
                            }} 
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-2">Spider X Path</label>
                            <input className="w-full p-5 bg-card border border-indigo-500/20 rounded-[1.5rem] font-mono text-sm text-base focus:border-indigo-500 transition-all shadow-2xl" placeholder="/" value={form.spiderX} onChange={e => setForm({...form, spiderX: e.target.value})} />
                        </div>
                        </div>

                        {/* Masking Settings */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-2">Server Names (SNI)</label>
                            <input className="w-full p-5 bg-card border border-indigo-500/20 rounded-[1.5rem] text-sm text-base focus:border-indigo-500 transition-all shadow-2xl" placeholder="example.com, www.example.com" value={form.serverNames} onChange={e => setForm({...form, serverNames: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-2">Fingerprint</label>
                            <select className="w-full p-5 bg-card border border-indigo-500/20 rounded-[1.5rem] font-black text-sm text-indigo-400 focus:border-indigo-500 outline-none transition-all shadow-2xl appearance-none cursor-pointer" value={form.fingerprint} onChange={e => setForm({...form, fingerprint: e.target.value})}>
                            <option value="chrome">Chrome</option>
                            <option value="firefox">Firefox</option>
                            <option value="safari">Safari</option>
                            <option value="randomized">Randomized</option>
                            </select>
                        </div>

                        <div className="space-y-4 md:col-span-2">
                            <div className="flex justify-between items-end ml-2">
                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Short IDs (HEX)</label>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => {
                                const newId = generateShortId(8);
                                setForm({...form, shortIds: form.shortIds ? `${form.shortIds}, ${newId}` : newId});
                                }} className="text-[8px] font-black bg-indigo-500/10 text-indigo-500 px-3 py-1.5 rounded-xl border border-indigo-500/20 hover:bg-indigo-500/20 transition-all">+8 HEX</button>
                                <button type="button" onClick={() => {
                                const newId = generateShortId(16);
                                setForm({...form, shortIds: form.shortIds ? `${form.shortIds}, ${newId}` : newId});
                                }} className="text-[8px] font-black bg-indigo-600 text-white px-3 py-1.5 rounded-xl shadow-lg shadow-indigo-900/40 active:scale-95 transition-all">+16 HEX</button>
                            </div>
                            </div>
                            <textarea className="w-full p-5 bg-main border border-indigo-500/20 rounded-[1.5rem] font-mono text-xs text-base min-h-[100px] focus:border-indigo-500 outline-none transition-all shadow-inner resize-none" placeholder="HEX IDs..." value={form.shortIds} onChange={e => setForm({...form, shortIds: e.target.value})} />
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-2">Max Time Diff</label>
                            <div className="flex items-center gap-4">
                            <input type="number" className="w-full p-5 bg-card border border-indigo-500/20 rounded-[1.5rem] font-black text-sm text-base focus:border-indigo-500 transition-all shadow-2xl" value={form.maxTimediff / 1000} onChange={e => setForm({...form, maxTimediff: (parseInt(e.target.value) || 0) * 1000})} placeholder="60" />
                            <span className="text-[10px] font-black text-indigo-500">SEC</span>
                            </div>
                            <p className="text-[8px] text-muted font-bold uppercase tracking-tight leading-relaxed px-2">
                            Time sync tolerance. 0 = 60s default.
                            </p>
                        </div>
                        </div>
                        
                        {/* Keys Section */}
                        <div className="space-y-6 pt-8 border-t border-indigo-500/10">
                        <div className="flex justify-between items-center px-2">
                            <h5 className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em]">Cryptography Keys</h5>
                            <button type="button" onClick={handleGenerateKeys} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shadow-xl shadow-indigo-900/40 active:scale-95">Generate New Pair</button>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                            <label className="text-[9px] font-black text-red-500/50 uppercase tracking-widest ml-2">Private Key (Hidden)</label>
                            <input className={`w-full p-5 bg-main/50 rounded-[1.5rem] font-mono text-[10px] border tracking-widest ${!form.privateKey ? 'border-red-500/40 text-red-500 animate-pulse' : 'border-line text-muted'}`} value={form.privateKey} readOnly placeholder="GENERATE KEYS TO VIEW" />
                            </div>
                            <div className="space-y-2">
                            <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-2">Public Key (Visible)</label>
                            <input className={`w-full p-5 bg-card rounded-[1.5rem] font-mono text-[10px] text-base border ${!form.publicKey ? 'border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'border-indigo-500/30'} focus:border-indigo-500 transition-all shadow-2xl`} value={form.publicKey} onChange={e => setForm({...form, publicKey: e.target.value})} placeholder="X25519 Public Key..." />
                            </div>
                        </div>
                        </div>
                    </div>
                    )}
                </div>
                )}

              {/* TAB: SNIFFING */}
                {activeTab === 'sniffing' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Глобальный переключатель Sniffing */}
                    <div className={`flex items-center justify-between p-8 bg-card border rounded-[2.5rem] transition-all duration-500 ${form.sniffingEnabled ? 'border-indigo-500/30 shadow-2xl shadow-indigo-900/20' : 'border-line opacity-60'}`}>
                    <div className="flex items-center gap-5">
                        <div className={`p-4 rounded-2xl transition-colors ${form.sniffingEnabled ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'bg-main text-muted border border-line'}`}>
                        <Search size={24}/>
                        </div>
                        <div>
                        <span className="font-black text-base uppercase tracking-widest text-[12px]">Анализ трафика (Sniffing)</span>
                        <p className="text-[9px] text-muted font-bold uppercase tracking-tighter mt-1">Определение доменов внутри зашифрованных соединений</p>
                        </div>
                    </div>
                    <input 
                        type="checkbox" 
                        className="w-7 h-7 rounded-xl border-line bg-main text-indigo-600 accent-indigo-600 cursor-pointer" 
                        checked={form.sniffingEnabled} 
                        onChange={e => setForm({...form, sniffingEnabled: e.target.checked})} 
                    />
                    </div>
                    
                    {form.sniffingEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in zoom-in-95 duration-300">
                        <div className="space-y-4 p-8 bg-card border border-line rounded-[3rem] shadow-xl">
                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-2">
                            Dest Override (Protocols)
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {['http', 'tls', 'quic', 'fakedns'].map((type) => {
                            const selectedTypes = form.destOverride.split(',').map((t: string) => t.trim());
                            const isChecked = selectedTypes.includes(type);

                            return (
                                <label 
                                key={type} 
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group ${
                                    isChecked 
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' 
                                    : 'bg-main border-line text-muted hover:border-indigo-500/30'
                                }`}
                                >
                                <span className="text-[11px] font-black uppercase tracking-widest">{type}</span>
                                <input 
                                    type="checkbox" 
                                    className="hidden" 
                                    checked={isChecked}
                                    onChange={() => {
                                    let newTypes = isChecked ? selectedTypes.filter((t: string) => t !== type) : [...selectedTypes, type];
                                    setForm({ ...form, destOverride: newTypes.filter(Boolean).join(', ') });
                                    }}
                                />
                                <div className={`w-2 h-2 rounded-full transition-all ${isChecked ? 'bg-white animate-pulse' : 'bg-line group-hover:bg-indigo-500/50'}`} />
                                </label>
                            );
                            })}
                        </div>
                        </div>

                        <div className="space-y-6">
                        <div className="space-y-3 p-8 bg-card border border-line rounded-[2.5rem] shadow-xl">
                            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-2">Domains Excluded</label>
                            <input 
                            className="w-full p-5 bg-main border border-line rounded-2xl font-mono text-xs text-base focus:border-indigo-500/50 outline-none transition-all shadow-inner" 
                            value={form.domainsExcluded} 
                            onChange={e => setForm({...form, domainsExcluded: e.target.value})} 
                            placeholder="apple.com, microsoft.com"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {[
                            { key: 'metadataOnly', label: 'Metadata Only' },
                            { key: 'routeOnly', label: 'Route Only' }
                            ].map(opt => (
                            <label key={opt.key} className="flex flex-col gap-3 p-5 bg-card border border-line rounded-[2rem] cursor-pointer hover:border-indigo-500/30 transition-all group shadow-xl">
                                <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black text-muted uppercase tracking-widest group-hover:text-base transition-colors">{opt.label}</span>
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 accent-indigo-600"
                                    checked={(form as any)[opt.key]} 
                                    onChange={e => setForm({...form, [opt.key]: e.target.checked})} 
                                />
                                </div>
                            </label>
                            ))}
                        </div>
                        </div>
                    </div>
                    )}
                </div>
                )}

                {/* TAB: SOCKOPT */}
                {activeTab === 'sockopt' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Master Switch */}
                    <label className={`flex items-center justify-between p-8 rounded-[3rem] border-2 transition-all duration-500 cursor-pointer shadow-2xl ${form.enableSockopt ? 'bg-indigo-600/5 border-indigo-500/30' : 'bg-card border-line opacity-40 grayscale'}`}>
                    <div className="flex items-center gap-6">
                        <div className={`p-4 rounded-[1.5rem] transition-all ${form.enableSockopt ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/40 translate-y-[-2px]' : 'bg-main text-muted border border-line'}`}>
                        <Zap size={24} />
                        </div>
                        <div>
                        <h3 className="text-sm font-black text-base uppercase tracking-[0.2em]">Сетевой акселератор</h3>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-tighter mt-1 italic">BBR, Fast Open и тонкая настройка стека TCP</p>
                        </div>
                    </div>
                    <input 
                        type="checkbox" 
                        className="w-7 h-7 accent-indigo-600 rounded-xl"
                        checked={form.enableSockopt}
                        onChange={e => setForm({...form, enableSockopt: e.target.checked})}
                        disabled={form.network === 'xhttp'}
                    />
                    </label>

                    {form.enableSockopt && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-top-4 duration-500">
                        <div className="space-y-2">
                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-4">TCP Congestion (Kernel)</label>
                        <div className="relative">
                            <select className="w-full p-5 bg-card border border-line rounded-[1.5rem] font-black text-sm text-indigo-400 outline-none focus:border-indigo-500/50 transition-all appearance-none cursor-pointer shadow-xl" value={form.tcpCongestion} onChange={e => setForm({...form, tcpCongestion: e.target.value})}>
                            <option value="bbr">BBR (Best Performance)</option>
                            <option value="cubic">CUBIC (Standard)</option>
                            <option value="reno">RENO</option>
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-muted"><RefreshCcw size={16}/></div>
                        </div>
                        </div>
                        
                        <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-4">TProxy Mode</label>
                        <select className="w-full p-5 bg-card border border-line rounded-[1.5rem] font-black text-sm text-base outline-none focus:border-indigo-500/50 shadow-xl" value={form.tproxy} onChange={e => setForm({...form, tproxy: e.target.value})}>
                            <option value="off">Off (Standard)</option>
                            <option value="tproxy">TProxy (Transparent)</option>
                            <option value="redirect">Redirect</option>
                        </select>
                        </div>

                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { key: 'tcpFastOpen', label: 'Fast Open', desc: 'Zero-RTT Start' },
                            { key: 'tcpMptcp', label: 'MPTCP', desc: 'Multi-path TCP' },
                            { key: 'tcpNoDelay', label: 'No Delay', desc: 'Ping Optimizer' },
                        ].map(opt => (
                            <label key={opt.key} className="flex flex-col gap-3 p-6 bg-card border border-line rounded-[2.5rem] cursor-pointer hover:border-indigo-500/30 transition-all group shadow-xl">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-base uppercase tracking-widest">{opt.label}</span>
                                <input type="checkbox" className="w-6 h-6 accent-indigo-600" checked={(form as any)[opt.key]} onChange={e => setForm({...form, [opt.key]: e.target.checked})} />
                            </div>
                            <span className="text-[8px] text-muted font-bold uppercase tracking-widest">{opt.desc}</span>
                            </label>
                        ))}
                        </div>

                        {/* ADVANCED TCP TUNING */}
                        <div className="md:col-span-2 pt-8 border-t border-line">
                        <h4 className="text-[10px] font-black text-indigo-500/50 uppercase tracking-[0.3em] mb-6 ml-2">Kernel Tuning Parameters</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                            { key: 'tcpMaxSeg', label: 'Max Seg', placeholder: '1440' },
                            { key: 'tcpUserTimeout', label: 'User Timeout', placeholder: '10000' },
                            { key: 'tcpKeepAliveIdle', label: 'KeepAlive', placeholder: '60' },
                            ].map(field => (
                            <div key={field.key} className="space-y-2">
                                <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-2">{field.label}</label>
                                <input 
                                type="number"
                                className="w-full p-4 bg-main border border-line rounded-2xl font-mono text-xs text-indigo-400 focus:border-indigo-500/50 transition-all shadow-inner"
                                value={(form as any)[field.key]}
                                onChange={e => setForm({...form, [field.key]: Number(e.target.value)})}
                                placeholder={field.placeholder}
                                />
                            </div>
                            ))}

                            <div className="space-y-2">
                            <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-2">Domain Strategy</label>
                            <select className="w-full p-4 bg-main border border-line rounded-2xl font-black text-[10px] text-base outline-none focus:border-indigo-500/50" value={form.domainStrategy} onChange={e => setForm({...form, domainStrategy: e.target.value})}>
                                <option value="AsIs">AsIs</option>
                                <option value="UseIP">UseIP</option>
                                <option value="UseIPv4">UseIPv4</option>
                                <option value="UseIPv6">UseIPv6</option>
                            </select>
                            </div>
                        </div>
                        <p className="text-[8px] text-muted mt-6 italic font-bold uppercase tracking-tighter opacity-50 px-2 text-center">
                            * 1440 MTU / UseIP — рекомендуемые параметры для стабильного обхода DPI и оптимизации фрагментации пакетов.
                        </p>
                        </div>
                    </div>
                    )}
                </div>
                )}
            </form>

            <div className="p-8 bg-card/50 border-t border-line flex justify-end gap-4 relative overflow-hidden">
                {/* Декоративный эффект свечения под кнопкой сохранения */}
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-600/5 blur-[80px] pointer-events-none" />

                <button 
                    type="button"
                    onClick={onClose}
                    className="px-10 py-5 bg-main text-muted font-black text-[10px] uppercase tracking-widest rounded-[1.5rem] border border-line hover:border-red-500/30 hover:text-red-500 transition-all active:scale-95 shadow-lg"
                >
                    Отмена
                </button>
                
                <button 
                    form="edit-form"
                    disabled={loading}
                    className="group px-10 py-5 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-[1.5rem] shadow-[0_10px_40px_rgba(79,70,229,0.3)] hover:shadow-[0_15px_50px_rgba(79,70,229,0.4)] hover:bg-indigo-500 transition-all flex items-center gap-3 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed active:scale-95"
                >
                    {loading ? (
                    <Loader2 className="animate-spin" size={18} />
                    ) : (
                    <RefreshCcw size={18} className="group-hover:rotate-180 transition-transform duration-700" />
                    )}
                    <span>{loading ? 'Синхронизация...' : 'Сохранить конфиг'}</span>
                </button>
                </div>
          </>
        )}
      </div>
    </div>
  );
}



