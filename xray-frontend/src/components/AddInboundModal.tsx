import { useState, useEffect } from "react";
import { 
  X, Shield, Zap, Loader2, Search, Globe, Lock,
  Settings, Plus, Trash2, Cpu, Hash, Check
} from "lucide-react";
import { generateXrayKeys, addClient } from "../api/user";
import {  addInbound } from "../api/inbound"

const generateComplexPath = () => {
  const randomStr = Math.random().toString(36).substring(2, 12); // 10 символов
  return `/${randomStr}`;
};
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback для HTTP
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
const generateShortId = (length = 8) => {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};
const randomPaths = ["/", "/download", "/support", "/security", "/en-us/windows"];
const getRandomPath = () => randomPaths[Math.floor(Math.random() * randomPaths.length)];
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
const getEmptyForm = () => ({
    // --- 1. Основные настройки Inbound ---
    tag: "",
    port: 443,
    listen: "0.0.0.0",
    protocol: "vless",
    flow: "", 
    decryption: "none",
    fallbackDest: "80",
    
    // --- 2. Глобальные настройки Stream & Security ---
    network: "raw",
    security: "none",
    
    
    // --- 3. Reality Settings ---
    show: false,
    dest: "www.microsoft.com:443",
    xver: 0,
    serverNames: "www.microsoft.com, microsoft.com",
    privateKey: "",
    publicKey: "", 
    minClientVer: "",
    maxClientVer: "",
    shortIds: "",
    fingerprint: "chrome",
    spiderX: getRandomPath(),
    limitFallbackUpload: 0,
    limitFallbackDownload: 0,
    maxTimediff: 0, // Дубликат удален, оставлен один

    // --- 4. Trojan & Clients ---
    password: "",
    clients: [
      {
        uuid: generateUUID(),
        email: "",
        flow: "",
        alterId: 0,
        security: "auto",
        password: Math.random().toString(36).slice(-10),
        level: 0,
      }
    ],

    // --- 5. Sniffing ---
    sniffingEnabled: true,
    destOverride: "http, tls, quic, fakedns",
    metadataOnly: false,
    domainsExcluded: "",
    routeOnly: false,

    // --- 6. Sockopt & Performance (Оптимизации) ---
    enableSockopt: false,
    mark: 0,
    tcpMaxSeg: 1440,
    tcpFastOpen: true,    // Значение из блока оптимизаций
    tproxy: "off",
    tcpCongestion: "bbr", // Значение из блока оптимизаций
    tcpMptcp: false,      // Переименовано в tcpMptcp для единообразия
    mptcp: false,         // Оставлено для совместимости, если где-то юзается
    noDelay: true,
    tcpNoDelay: true,     // Дубликат для безопасности кода
    domainStrategy: "UseIP",
    tcpKeepAliveIdle: 300,
    tcpUserTimeout: 10000,

    // --- 7. Транспорт: WebSocket ---
    wsPath: "/",
    wsHost: "",

    // --- 8. Транспорт: gRPC ---
    grpcServiceName: getRandomGrpcService(),
    grpcAuthority: "", // Поле для домена (Host)
    grpcMultiMode: false,

    // --- 9. Транспорт: RAW / TCP / HTTP Masking ---
    acceptProxyProtocol: false,
    tcpHeaderType: "none",
    httpHost: "www.bing.com", 
    httpPath: "/",

    // --- 10. Транспорт: xHTTP ---
    xhttpPath: "/",
    xhttpMode: "stream-up",
    xhttpPadding: "100-1000",

    // --- 11. TLS Settings (обычный TLS) ---
    tlsServerName: "",
    alpn: "h2, http/1.1",
    minVersion: "1.2",
    maxVersion: "1.3",
    cipherSuites: "",
    allowInsecure: false,
    certFile: "",
    keyFile: "",
    tlsKeyPath: "",
    tlsCertPath: "",
});

  export default function AddInboundModal({ isOpen, onClose, onSuccess }: any) {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('base')

  
  const [form, setForm] = useState(getEmptyForm());

  
  const handleClose = () => {
    setForm(getEmptyForm()); // Теперь типы совпадают, так как это полный объект
    setActiveTab('base');    // Возвращаем на первую вкладку
    onClose();
  };
  
  // Эффект для xHTTP сокетов
useEffect(() => {
  const isXHttp = form.network === 'xhttp';
  
  setForm(prev => {
    const updates: any = {};

    if (isXHttp) {
      // Для xHTTP принудительно ставим порт 0 и путь к сокету
      updates.port = 0;
      updates.listen = prev.tag ? `/run/xray/${prev.tag}.sock` : "/run/xray/default.sock";
      updates.enableSockopt = true;
    } else {
      // Если ушли с xHTTP на что-то другое (включая grpc), возвращаем стандартные значения
      // только если там стоял "сокетовый" режим
      if (prev.port === 0) updates.port = 443;
      if (prev.listen.startsWith('/run/xray/')) updates.listen = "0.0.0.0";
    }

    if (Object.keys(updates).length > 0) {
      return { ...prev, ...updates };
    }
    return prev;
  });
}, [form.network]);

// Эффект для синхронизации пути сокета с Tag (только для xHTTP)
useEffect(() => {
  if (form.network === 'xhttp' && form.tag) {
    setForm(prev => ({
      ...prev,
      listen: `/run/xray/${form.tag}.sock`
    }));
  }
}, [form.tag]);

// Отдельный эффект для специфики gRPC (без сокетов)
useEffect(() => {
  if (form.network === 'grpc') {
    setForm(prev => ({ 
      ...prev, 
      sniffingEnabled: true, 
      enableSockopt: true 
    }));
  }
}, [form.network]);
  useEffect(() => {
    if (form.network === 'ws' && form.security === 'reality') {
      // Если пользователь выбрал WS, принудительно ставим безопасность TLS или None
      setForm(prev => ({ ...prev, security: 'tls' }));
    }
  }, [form.network]);
  
  useEffect(() => {
    if (!isOpen) {
      setForm(getEmptyForm());
    }
  }, [isOpen]);
  
  if (!isOpen) return null;

  const handleGenerateKeys = async () => {
    try {
      const keys = await generateXrayKeys();
      setForm(prev => ({ ...prev, privateKey: keys.private_key, publicKey: keys.public_key }));
    } catch (e) { console.error(e); }
  };

  const isRealityValid = () => {
    if (form.security === 'reality') {
      // Проверяем наличие ключей и целевого домена
      return form.privateKey.trim() !== "" && form.publicKey.trim() !== "" && form.dest.trim() !== "" && form.shortIds.trim() !== "";
    }
    return true; // Для 'none' или 'tls' считаем валидным (или добавь свои проверки)
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // --- 1. Логика очистки Flow ---
    // Flow разрешен ТОЛЬКО для протокола VLESS и ТОЛЬКО для сети TCP (raw)
    const canUseFlow = form.protocol === "vless" && form.network === "raw";
    
    let inboundSettings: any = {
        decryption: "none",
        // Если flow нельзя использовать, ставим undefined (ключ не попадет в JSON)
        flow: canUseFlow ? form.flow : undefined,
    };

    if (form.protocol === "trojan") {
        inboundSettings = {}; // Trojan управляет паролями через API или поле password
    }

    // Фоллбэки
    inboundSettings.fallbacks = form.network === "grpc" ? [] : [
      { 
        dest: isNaN(Number(form.fallbackDest)) ? form.fallbackDest : Number(form.fallbackDest), 
        xver: 0 
      }
    ];
     
    const payload = {
      tag: form.tag,
      protocol: form.protocol,
      port: form.port,
      listen: form.listen,
      settings: inboundSettings,
      stream_settings: {
        network: form.network === "raw" ? "tcp" : form.network,
        security: form.security,
        
        // Добавляем rawSettings
        tcpSettings: form.network === "raw" ? {
          acceptProxyProtocol: form.acceptProxyProtocol,
          header: {
            // Если Reality, то ВСЕГДА none, иначе берем из формы
            type: form.security === 'reality' ? "none" : form.tcpHeaderType,
            ...(form.tcpHeaderType === "http" && form.security !== 'reality' ? {
              request: {
                version: "1.1",
                method: "GET",
                path: [form.httpPath],
                headers: {
                  "Host": [form.httpHost],
                  "User-Agent": [
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                  ],
                  "Accept-Encoding": ["gzip, deflate"],
                  "Connection": ["keep-alive"],
                  "Pragma": "no-cache"
                }
              },
              response: {
                version: "1.1",
                status: "200",
                reason: "OK",
                headers: {
                  "Content-Type": ["application/octet-stream"],
                  "Transfer-Encoding": ["chunked"],
                  "Connection": ["keep-alive"],
                  "Pragma": "no-cache"
                }
              }
            } : {})
          }
        }: undefined,
        wsSettings: form.network === "ws" ? {
          acceptProxyProtocol: form.acceptProxyProtocol, // В WS это поле внутри wsSettings
          path: form.wsPath || "/",
          host: form.wsHost || "",
          // Можно добавить пустые заголовки или оставить как есть
          headers: form.wsHost ? { "Host": form.wsHost } : {}
        } : undefined,
        ...(form.network === "grpc" && { 
          grpcSettings: {
            serviceName: form.grpcServiceName,
            multiMode: form.grpcMultiMode,
            authority: form.grpcAuthority || undefined, // Отправляем только если заполнено
          }
        }),
        xhttpSettings: form.network === 'xhttp' ? {
          path: form.xhttpPath || "/",
          mode: form.xhttpMode || "stream-up",
          // Добавляем поддержку Padding из нашего анализа первого конфига
          extra: form.xhttpPadding ? {
            padding: form.xhttpPadding 
          } : {}
        } : undefined,
        realitySettings: form.security === "reality" ? {
          show: form.show,
          dest: form.dest,
          xver: form.xver,
          serverNames: form.serverNames.split(",").map(s => s.trim()).filter(Boolean),
          privateKey: form.privateKey,
          shortIds: form.shortIds.split(",").map(s => s.trim()).filter(Boolean),
          maxTimediff: form.maxTimediff || 0,
          fingerprint: form.fingerprint,
          spiderX: form.spiderX,
          publicKey: form.publicKey,
        } : undefined,
        tlsSettings: form.security === "tls" ? {
          serverName: form.tlsServerName,
          alpn: form.alpn.split(",").map(s => s.trim()).filter(Boolean),
          allowInsecure: form.allowInsecure,
          certificates: (form.tlsCertPath && form.tlsKeyPath) ? [
            {
              certificateFile: form.tlsCertPath,
              keyFile: form.tlsKeyPath
            }
          ] : []
        } : undefined,
        ...(form.enableSockopt ? {
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
        } : {})
      },
      sniffing: {
        enabled: form.sniffingEnabled,
        destOverride: form.destOverride.split(",").map(s => s.trim()),
        metadataOnly: form.metadataOnly,
        domainsExcluded: form.domainsExcluded.split(",").map(s => s.trim()),
        routeOnly: form.routeOnly
      }
    };

    try {
      const inboundResponse = await addInbound(payload);
      const inboundId = inboundResponse.data.id;

      // Добавляем клиентов. Для Trojan передаем password вместо uuid в поле id
      const clientPromises = form.clients.map(client => {
        return addClient(
          inboundId, 
          client.email, 
          form.protocol === 'vless' ? client.uuid : client.password, // Умное переключение
          form.protocol === 'vless' ? client.flow : "", 
          client.level,
        );
      });

      await Promise.all(clientPromises);
      onSuccess();
      handleClose();
    } catch (err: any) {
      alert("Ошибка: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 transition-all">
      {/* Основной контейнер: bg-card, border-line */}
      <div className="bg-card w-full max-w-4xl rounded-[3rem] shadow-2xl border border-line overflow-hidden flex flex-col h-[90vh] transition-colors">
        
        {/* Header: bg-main/50 */}
        <div className="p-6 bg-main/50 border-b border-line flex justify-between items-center">
          <div className="flex items-center gap-4 text-base">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg dark:shadow-indigo-950/40 shadow-indigo-200">
              <Cpu size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Xray Inbound Configurator</h2>
              <p className="text-[10px] font-bold text-indigo-500 uppercase">Версия ядра: v24.9.30+</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-main rounded-full text-muted hover:text-base transition-colors">
            <X />
          </button>
        </div>

        {/* Navigation Tabs: bg-card */}
        <div className="flex px-8 py-4 gap-2 bg-card border-b border-line overflow-x-auto no-scrollbar">
          {[
            { id: 'base', label: 'База', icon: Zap },
            { id: 'transport', label: 'Транспорт', icon: Globe },
            { id: 'security', label: 'Шифрование', icon: Shield },
            { id: 'sniffing', label: 'Сниффинг', icon: Search },
            { id: 'sockopt', label: 'Сокеты', icon: Settings },
            { id: 'clients', label: 'Клиенты', icon: Lock },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[11px] uppercase transition-all shrink-0 ${
                activeTab === tab.id 
                  ? 'bg-indigo-600 text-white shadow-lg dark:shadow-indigo-900/30 shadow-indigo-100' 
                  : 'bg-main text-muted hover:bg-main/80 border border-transparent hover:border-line'
              }`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar bg-card">
          
          {/* TAB: BASE */}
          {activeTab === 'base' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Сетка основных параметров */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted uppercase ml-1">Tag (Уникальный)</label>
                  <input 
                    required 
                    className="w-full p-4 bg-main border border-line rounded-2xl font-bold text-sm text-base focus:border-indigo-500 transition-all outline-none" 
                    value={form.tag} 
                    onChange={e => setForm({...form, tag: e.target.value})} 
                    placeholder="VLESS_REALITY" 
                  />
                </div>
                
                {/* Поле ПОРТ */}
                <div className="space-y-1 relative">
                  <label className="text-[10px] font-black text-muted uppercase ml-1 flex justify-between">
                    Порт
                    {form.network === 'xhttp' && <Lock size={10} className="text-indigo-500" />}
                  </label>
                  <input 
                    type="number" 
                    disabled={form.network === 'xhttp'}
                    className={`w-full p-4 border rounded-2xl font-mono font-bold text-sm transition-all outline-none ${
                      form.network === 'xhttp' 
                        ? 'bg-main text-muted border-line cursor-not-allowed opacity-50' 
                        : 'bg-card border-line text-base focus:border-indigo-500'
                    }`} 
                    value={form.port} 
                    onChange={e => setForm({...form, port: parseInt(e.target.value) || 0})} 
                  />
                </div>

                {/* Поле LISTEN */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted uppercase ml-1 flex justify-between">
                    { form.network === 'xhttp' ? "Путь к сокету (UDS)" : "IP прослушивания" }
                    {form.network === 'xhttp' && <Zap size={10} className="text-emerald-500" />}
                  </label>
                  <input 
                    readOnly={form.network === 'xhttp'}
                    className={`w-full p-4 border rounded-2xl font-mono text-sm transition-all outline-none ${
                      form.network === 'xhttp' 
                        ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20 cursor-default italic' 
                        : 'bg-card border-line text-base focus:border-indigo-500'
                    }`} 
                    value={form.listen} 
                    onChange={e => setForm({...form, listen: e.target.value})} 
                  />
                </div>
              </div>

              <hr className="border-line opacity-50" />

              {/* ВЫБОР ПРОТОКОЛА */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase ml-1">Выбор протокола</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['vless', 'trojan', 'shadowsocks', 'vmess'].map((proto) => {
                    const isLocked = proto === 'shadowsocks' || proto === 'vmess';
                    
                    return (
                      <button
                        key={proto}
                        type="button"
                        disabled={isLocked}
                        onClick={() => setForm({ ...form, protocol: proto })}
                        className={`py-4 rounded-2xl font-black text-[11px] uppercase transition-all border ${
                          form.protocol === proto 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg dark:shadow-indigo-900/30 shadow-indigo-100' 
                            : 'bg-main text-muted border-line hover:border-indigo-500/50'
                        } ${isLocked ? 'opacity-30 cursor-not-allowed grayscale border-dashed' : ''}`}
                      >
                        {proto}
                        {isLocked && <span className="block text-[6px] mt-1 opacity-50 uppercase">Soon</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* СПЕЦИФИЧНЫЕ НАСТРОЙКИ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {form.protocol === 'vless' && (
                  <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-black text-muted uppercase ml-1">Default Flow</label>
                    <select 
                      className="w-full p-4 bg-card border border-indigo-500/30 rounded-2xl font-bold text-sm text-indigo-500 outline-none focus:border-indigo-500 transition-all"
                      value={form.flow}
                      onChange={e => setForm({...form, flow: e.target.value})}
                    >
                      <option value="xtls-rprx-vision">XTLS Vision (Best)</option>
                      <option value="">None (Legacy)</option>
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted uppercase ml-1 flex justify-between">
                    Fallback Dest (HTTP)
                    {form.network === 'grpc' && <span className="text-amber-500 font-bold">Incompatible with gRPC</span>}
                  </label>
                  <input 
                    disabled={form.network === 'grpc'}
                    className={`w-full p-4 border rounded-2xl font-bold text-sm transition-all outline-none ${
                      form.network === 'grpc' 
                        ? 'bg-main text-muted/30 border-line cursor-not-allowed' 
                        : 'bg-card border-line text-base focus:border-indigo-500'
                    }`}
                    value={form.network === 'grpc' ? "" : form.fallbackDest} 
                    onChange={e => setForm({...form, fallbackDest: e.target.value})}
                    placeholder="80 или 127.0.0.1:8080"
                  />
                </div>
              </div>

            </div>
          )}

          {/* TAB: TRANSPORT */}
          {activeTab === 'transport' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* ВЫБОР ТИПА СЕТИ (Network Type) */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase ml-1">Тип сети (Network Type)</label>
                <div className="grid grid-cols-4 gap-3">
                  {['raw', 'ws', 'grpc', 'xhttp'].map((net) => {
                    const isDisabled = form.security === 'reality' && net === 'ws';
                    
                    return (
                      <button
                        key={net}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setForm({ ...form, network: net })}
                        className={`py-4 rounded-2xl font-black text-[11px] uppercase transition-all border ${
                          form.network === net 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg dark:shadow-indigo-900/30' 
                            : 'bg-main text-muted border-line hover:border-indigo-500/50'
                        } ${isDisabled ? 'opacity-20 cursor-not-allowed bg-main border-dashed' : ''}`}
                      >
                        {net === 'raw' ? 'TCP / RAW' : net.toUpperCase()}
                        {isDisabled && <span className="block text-[8px] text-amber-500 mt-1 uppercase">No Reality</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <hr className="border-line opacity-50" />

              {/* Настройки для RAW */}
              {form.network === 'raw' && (
                <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                  {/* Proxy Protocol Switch */}
                  <div className="flex items-center justify-between p-4 bg-main/50 rounded-2xl border border-line">
                    <div>
                      <h4 className="text-sm font-bold text-base">Accept Proxy Protocol</h4>
                      <p className="text-[10px] text-muted">Для работы через Nginx/HAProxy</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm({...form, acceptProxyProtocol: !form.acceptProxyProtocol})}
                      className={`w-12 h-6 rounded-full transition-colors relative ${form.acceptProxyProtocol ? 'bg-indigo-600' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${form.acceptProxyProtocol ? 'translate-x-6' : ''}`} />
                    </button>
                  </div>

                  {/* Header Type */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase ml-1 flex justify-between">
                      Тип маскировки (Header Type)
                      {form.security === 'reality' && (
                        <span className="text-amber-500 normal-case font-medium">Reality требует 'none'</span>
                      )}
                    </label>
                    <select 
                      disabled={form.security === 'reality'}
                      className={`w-full p-4 rounded-2xl font-bold border transition-all outline-none ${
                        form.security === 'reality' 
                        ? 'bg-main text-muted border-line cursor-not-allowed' 
                        : 'bg-card text-indigo-500 border-indigo-500/30 focus:border-indigo-500'
                      }`}
                      value={form.security === 'reality' ? 'none' : form.tcpHeaderType}
                      onChange={e => setForm({...form, tcpHeaderType: e.target.value})}
                    >
                      <option value="none">None (Без маскировки)</option>
                      <option value="http">HTTP (Маскировка под веб-трафик)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Настройки для WebSocket (WS) */}
              {form.network === 'ws' && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-indigo-500 uppercase ml-1 flex justify-between">
                        WS Path
                        <button 
                          type="button"
                          onClick={() => setForm({...form, wsPath: generateComplexPath()})}
                          className="text-indigo-600 hover:text-indigo-400 transition-colors lowercase font-bold"
                        >
                          + сгенерировать путь
                        </button>
                      </label>
                      <div className="relative">
                        <input 
                          className="w-full p-4 bg-card border border-line rounded-xl font-mono text-sm text-base pr-10 focus:border-indigo-500 outline-none transition-all" 
                          value={form.wsPath} 
                          onChange={e => setForm({...form, wsPath: e.target.value})} 
                          placeholder="/secret-path" 
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted/50">
                          <Hash size={16} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-indigo-500 uppercase ml-1">WS Host (SNI)</label>
                      <div className="relative">
                        <input 
                          className="w-full p-4 bg-card border border-line rounded-xl font-mono text-sm text-base pr-10 focus:border-indigo-500 outline-none transition-all" 
                          value={form.wsHost} 
                          onChange={e => setForm({...form, wsHost: e.target.value})} 
                          placeholder="example.com" 
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted/50">
                          <Globe size={16} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* gRPC Settings */}
              {form.network === 'grpc' && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-emerald-500 uppercase ml-1">Service Name</label>
                      <div className="relative">
                        <input 
                          className="w-full p-4 bg-card border border-line rounded-xl font-mono text-sm text-base pr-12 focus:border-emerald-500 outline-none" 
                          value={form.grpcServiceName} 
                          onChange={e => setForm({...form, grpcServiceName: e.target.value})} 
                        />
                        <button 
                          type="button"
                          onClick={() => setForm({...form, grpcServiceName: getRandomGrpcService()})}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-emerald-500 hover:text-emerald-400 transition-colors"
                        >
                          <Zap size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-emerald-500 uppercase ml-1">Authority (Domain)</label>
                      <input 
                        className="w-full p-4 bg-card border border-line rounded-xl font-mono text-sm text-base outline-none focus:border-emerald-500" 
                        value={form.grpcAuthority} 
                        onChange={e => setForm({...form, grpcAuthority: e.target.value})} 
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-card border border-line rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-base">Multi Mode</span>
                        <span className="text-[8px] text-muted">Поддержка сессий</span>
                      </div>
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 accent-emerald-500 rounded-lg cursor-pointer"
                        checked={form.grpcMultiMode}
                        onChange={e => setForm({...form, grpcMultiMode: e.target.checked})}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* xHttp */}
              {form.network === 'xhttp' && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-indigo-500 uppercase ml-1">Path
                        <button 
                          type="button"
                          onClick={() => setForm({...form, xhttpPath: generateComplexPath()})}
                          className="text-indigo-600 hover:text-indigo-400 transition-colors lowercase font-bold"
                        >
                          + сгенерировать путь
                        </button>
                      </label>
                      <input 
                        className="w-full p-4 bg-card border border-line rounded-xl font-mono text-sm text-base focus:border-indigo-500 outline-none transition-all" 
                        value={form.xhttpPath} 
                        onChange={e => setForm({...form, xhttpPath: e.target.value})} 
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-indigo-500 uppercase ml-1">Mode</label>
                      <select 
                        className="w-full p-4 bg-card border border-line rounded-xl font-bold text-sm text-base focus:border-indigo-500 outline-none"
                        value={form.xhttpMode}
                        onChange={e => setForm({...form, xhttpMode: e.target.value})}
                      >
                        <option value="stream-up">Stream Up (Fast)</option>
                        <option value="packet-up">Packet Up (Stealth)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-indigo-500 uppercase ml-1">Padding</label>
                      <input 
                        className="w-full p-4 bg-card border border-line rounded-xl font-mono text-sm text-base focus:border-indigo-500 outline-none" 
                        value={form.xhttpPadding} 
                        onChange={e => setForm({...form, xhttpPadding: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Уведомление про Unix Socket */}
              {(form.network === 'xhttp') && (
                <div className="mt-2 p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 flex items-start gap-3 animate-in zoom-in-95 duration-200">
                  <div className="mt-0.5 text-indigo-500"><Settings size={14} /></div>
                  <p className="text-[10px] text-indigo-500/80 leading-tight">
                    Для сети <strong>{form.network.toUpperCase()}</strong> автоматически включен режим <strong>Unix Domain Socket</strong>. 
                    Это повышает производительность связки с Nginx.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB: SECURITY (REALITY/TLS) */}
          {activeTab === 'security' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* Кнопки выбора шифрования (Блокируем их, если включен Nginx) */}
              <div className={`relative 'opacity-50 pointer-events-none' : ''}`}>
                
                
                <div className="grid grid-cols-3 gap-3">
                  {['none', 'tls', 'reality'].map((sec) => {
                    const isForbidden = form.network === 'ws' && sec === 'reality';

                  return (
                    <button
                      key={sec}
                      type="button"
                      disabled={isForbidden}
                      onClick={() => setForm({ ...form, security: sec })}
                      className={`p-4 rounded-2xl font-bold text-xs uppercase border transition-all ${
                        form.security === sec 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg dark:shadow-indigo-900/30' 
                          : 'bg-main text-muted border-line hover:border-indigo-500/50'
                      } ${isForbidden ? 'opacity-40 cursor-not-allowed bg-slate-50' : ''}`}
                    >
                      {sec}
                      {isForbidden && (
                        <span className="block text-[7px] text-amber-500 mt-1">
                          WS не поддерживает Reality
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
              {/* БЛОК: NONE (Ничего не показываем или инфо-плашка) */}
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
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex items-center justify-between p-6 bg-main/50 border border-line rounded-3xl transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${form.sniffingEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-main text-muted'}`}>
                    <Search size={20}/>
                  </div>
                  <span className="font-black text-base uppercase text-xs">Включить Sniffing</span>
                </div>
                <input 
                  type="checkbox" 
                  className="w-6 h-6 rounded-lg accent-indigo-600 cursor-pointer" 
                  checked={form.sniffingEnabled} 
                  onChange={e => setForm({...form, sniffingEnabled: e.target.checked})} 
                />
              </div>
              
              {form.sniffingEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-4 duration-300">
                  <div className="space-y-3 p-6 bg-main/30 border border-line rounded-4xl">
                    <label className="text-[10px] font-black text-muted uppercase ml-1">
                      Dest Override (Sniffing Types)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['http', 'tls', 'quic', 'fakedns'].map((type) => {
                        const selectedTypes = form.destOverride.split(',').map(t => t.trim());
                        const isChecked = selectedTypes.includes(type);

                        return (
                          <label 
                            key={type} 
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                              isChecked 
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg dark:shadow-indigo-900/20' 
                                : 'bg-card border-line text-muted hover:border-indigo-500/50'
                            }`}
                          >
                            <span className="text-[11px] font-black uppercase tracking-wider">{type}</span>
                            <input 
                              type="checkbox" 
                              className="hidden" 
                              checked={isChecked}
                              onChange={() => {
                                let newTypes = isChecked ? selectedTypes.filter(t => t !== type) : [...selectedTypes, type];
                                setForm({ ...form, destOverride: newTypes.filter(Boolean).join(', ') });
                              }}
                            />
                            {isChecked && <Check size={12} className="text-white" />}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2 p-6 bg-main/30 border border-line rounded-3xl">
                    <label className="text-[10px] font-black text-muted uppercase">Domains Excluded</label>
                    <input 
                      className="w-full p-4 bg-card border border-line rounded-xl font-mono text-xs text-base outline-none focus:border-indigo-500 transition-all" 
                      value={form.domainsExcluded} 
                      onChange={e => setForm({...form, domainsExcluded: e.target.value})} 
                      placeholder="example.com, google.com"
                    />
                  </div>

                  <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    {[
                      { key: 'metadataOnly', label: 'Metadata Only' },
                      { key: 'routeOnly', label: 'Route Only' }
                    ].map(opt => (
                      <label key={opt.key} className="flex items-center gap-3 p-4 bg-main/50 border border-line rounded-2xl cursor-pointer hover:bg-main transition-all">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 accent-indigo-600"
                          checked={(form as any)[opt.key]} 
                          onChange={e => setForm({...form, [opt.key]: e.target.checked})} 
                        />
                        <span className="text-xs font-bold text-muted uppercase tracking-tight">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: SOCKOPT */}
          {activeTab === 'sockopt' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Master Switch */}
              <label className={`flex items-center justify-between p-6 rounded-4xl border-2 transition-all cursor-pointer ${
                form.enableSockopt 
                  ? 'bg-indigo-500/10 border-indigo-500/30' 
                  : 'bg-main border-line opacity-60'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${form.enableSockopt ? 'bg-indigo-600 text-white shadow-lg' : 'bg-card text-muted'}`}>
                    <Zap size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-base uppercase">Глобальные оптимизации</h3>
                    <p className="text-[10px] text-muted font-medium italic">BBR, Fast Open и тонкая настройка стека TCP</p>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  className="w-6 h-6 accent-indigo-600"
                  checked={form.enableSockopt}
                  onChange={e => setForm({...form, enableSockopt: e.target.checked})}
                  disabled={form.network === 'xhttp'}
                />
              </label>

              {form.enableSockopt && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95 duration-300">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest ml-1">TCP Congestion (BBR)</label>
                    <select 
                      className="w-full p-4 bg-card border border-line rounded-2xl font-bold text-sm text-base outline-none focus:border-indigo-500 transition-all" 
                      value={form.tcpCongestion} 
                      onChange={e => setForm({...form, tcpCongestion: e.target.value})}
                    >
                      <option value="bbr">BBR (Best Performance)</option>
                      <option value="cubic">CUBIC (Standard)</option>
                      <option value="reno">RENO</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">TProxy Mode</label>
                    <select 
                      className="w-full p-4 bg-card border border-line rounded-2xl font-bold text-sm text-base outline-none focus:border-indigo-500 transition-all" 
                      value={form.tproxy} 
                      onChange={e => setForm({...form, tproxy: e.target.value})}
                    >
                      <option value="off">Off (Standard)</option>
                      <option value="tproxy">TProxy (Transparent)</option>
                      <option value="redirect">Redirect</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { key: 'tcpFastOpen', label: 'Fast Open', desc: 'Ускоряет старт' },
                      { key: 'tcpMptcp', label: 'MPTCP', desc: 'Multi-path TCP' },
                      { key: 'tcpNoDelay', label: 'No Delay', desc: 'Снижает пинг' },
                    ].map(opt => (
                      <label key={opt.key} className="flex flex-col gap-2 p-5 bg-card border border-line rounded-3xl cursor-pointer hover:border-indigo-500/50 transition-all group">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-base uppercase tracking-tight">{opt.label}</span>
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 accent-indigo-600"
                            checked={(form as any)[opt.key]} 
                            onChange={e => setForm({...form, [opt.key]: e.target.checked})} 
                          />
                        </div>
                        <span className="text-[8px] text-muted font-medium leading-none">{opt.desc}</span>
                      </label>
                    ))}
                  </div>

                  <div className="md:col-span-2 border-t border-line pt-6">
                    <h4 className="text-[10px] font-black text-muted uppercase tracking-widest mb-4 ml-1">
                      Advanced TCP Tuning
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Max Seg', key: 'tcpMaxSeg' },
                        { label: 'Timeout (ms)', key: 'tcpUserTimeout' },
                        { label: 'Idle (s)', key: 'tcpKeepAliveIdle' }
                      ].map(item => (
                        <div key={item.key} className="space-y-1">
                          <label className="text-[9px] font-bold text-muted ml-1">{item.label}</label>
                          <input 
                            type="number"
                            className="w-full p-3 bg-main border border-line rounded-xl font-mono text-xs text-base focus:border-indigo-500 outline-none transition-all"
                            value={(form as any)[item.key]}
                            onChange={e => setForm({...form, [item.key]: Number(e.target.value)})}
                          />
                        </div>
                      ))}

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-muted ml-1">Domain Strategy</label>
                        <select 
                          className="w-full p-3 bg-main border border-line rounded-xl font-bold text-xs text-base focus:border-indigo-500 outline-none transition-all"
                          value={form.domainStrategy}
                          onChange={e => setForm({...form, domainStrategy: e.target.value})}
                        >
                          <option value="AsIs">AsIs</option>
                          <option value="UseIP">UseIP</option>
                          <option value="UseIPv4">UseIPv4</option>
                          <option value="UseIPv6">UseIPv6</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-[8px] text-muted mt-3 italic px-1">
                      * Эти параметры влияют на обход DPI. 1440/UseIP — рекомендуемые значения.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* TAB: CLIENTS */}
          {activeTab === 'clients' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-base uppercase text-sm tracking-tight">Список пользователей</h3>
              <button 
                type="button" 
                onClick={() => setForm({
                  ...form, 
                  clients: [...form.clients, { 
                    uuid: crypto.randomUUID(), 
                    email: "", 
                    flow: form.protocol === "vless" ? "xtls-rprx-vision" : "", 
                    level: 0,
                    alterId: 0,
                    security: "auto",
                    password: ""
                  }]
                })}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-500 rounded-xl font-bold text-xs hover:bg-indigo-500/20 transition-all border border-indigo-500/20"
              >
                <Plus size={14} /> Добавить
              </button>
            </div>

            <div className="space-y-4">
              {form.clients.map((client, idx) => (
                <div key={idx} className="group relative p-6 bg-main/30 border border-line rounded-4xl space-y-4 hover:border-indigo-500/30 transition-all">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-muted uppercase ml-1">Email / Имя</label>
                      <input 
                        className="w-full p-3 bg-card border border-line rounded-xl font-bold text-sm text-base focus:border-indigo-500 outline-none transition-all" 
                        value={client.email} 
                        onChange={(e) => {
                          const c = [...form.clients];
                          c[idx].email = e.target.value;
                          setForm({...form, clients: c});
                        }} 
                        placeholder="user@example.com"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-muted uppercase ml-1">
                        {form.protocol === 'vless' ? 'UUID' : 'Пароль (Password)'}
                      </label>
                      <div className="flex gap-2">
                        <input 
                          className="flex-1 p-3 bg-card border border-line rounded-xl font-mono text-sm text-base focus:border-indigo-500 outline-none transition-all" 
                          value={form.protocol === 'vless' ? client.uuid : client.password} 
                          onChange={(e) => {
                            const c = [...form.clients];
                            if (form.protocol === 'vless') c[idx].uuid = e.target.value;
                            else c[idx].password = e.target.value;
                            setForm({...form, clients: c});
                          }}
                        />
                        <button 
                          type="button" 
                          onClick={() => {
                            const c = [...form.clients];
                            if (form.protocol === 'vless') c[idx].uuid = generateUUID();
                            else c[idx].password = Math.random().toString(36).slice(-12);
                            setForm({...form, clients: c});
                          }} 
                          className="p-3 bg-main border border-line rounded-xl hover:text-indigo-500 hover:border-indigo-500 transition-all"
                        >
                          <Zap size={14}/>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-line/30">
                    {form.protocol === 'vless' && 
                    (form.security === 'reality' || form.security === 'tls') && 
                    form.network === 'raw' && (
                      <div className="space-y-1 animate-in zoom-in-95 duration-200">
                        <label className="text-[9px] font-black text-muted uppercase ml-1">Client Flow</label>
                        <select 
                          className="w-full p-3 bg-main border border-line rounded-xl font-bold text-xs text-indigo-500 outline-none focus:border-indigo-500"
                          value={client.flow}
                          onChange={(e) => {
                            const c = [...form.clients];
                            c[idx].flow = e.target.value;
                            setForm({...form, clients: c});
                          }}
                        >
                          <option value="">Наследовать (None)</option>
                          <option value="xtls-rprx-vision">XTLS Vision</option>
                        </select>
                      </div>
                    )}
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-muted uppercase ml-1">User Level</label>
                      <input 
                        type="number"
                        className="w-full p-3 bg-card border border-line rounded-xl font-bold text-xs text-base outline-none focus:border-indigo-500"
                        value={client.level}
                        onChange={(e) => {
                          const c = [...form.clients];
                          c[idx].level = parseInt(e.target.value) || 0;
                          setForm({...form, clients: c});
                        }}
                      />
                    </div>
                  </div>

                  {idx > 0 && (
                    <button 
                      type="button" 
                      onClick={() => setForm({...form, clients: form.clients.filter((_, i) => i !== idx)})}
                      className="absolute -top-2 -right-2 p-2 bg-card shadow-lg border border-line text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        </form>

        {/* Footer */}
        <div className="p-8 bg-main/50 border-t border-line flex gap-4 mt-auto">
          <button 
            onClick={handleClose} 
            className="flex-1 py-4 font-black text-muted uppercase tracking-widest hover:text-base transition-colors"
          >
            Отмена
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={loading || !isRealityValid() || !form.tag}
            className={`py-4 px-10 rounded-3xl font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 
              ${(loading || !isRealityValid() || !form.tag) 
                ? 'bg-main border border-line text-muted cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl dark:shadow-indigo-900/40 shadow-indigo-100 active:scale-95'}`}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Сохранить конфиг"}
          </button>
        </div>
      </div>
    </div>
  );
}
