import { useState, useEffect } from "react";
import { 
  X, Shield, Zap, Loader2, Search, Globe, Lock,
  Settings, Plus, Trash2, Cpu, Hash
} from "lucide-react";
import { generateXrayKeys, addClient } from "../api/user";
import {  addInbound } from "../api/inbound"

const generateComplexPath = () => {
  const randomNum = Math.floor(Math.random() * 90000) + 10000; // 5 цифр
  const randomStr = Math.random().toString(36).substring(2, 12); // 10 символов
  return `/${randomNum}/${randomStr}`;
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
    flow: "xtls-rprx-vision", 
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
        email: "user@xray",
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
  useEffect(() => {
    if (form.network === 'xhttp') {
      setForm(prev => ({ ...prev, enableSockopt: true }));
    }
  }, [form.network]);
  useEffect(() => {
    if (form.network === 'grpc') {
      setForm(prev => ({ 
        ...prev, 
        sniffingEnabled: false, // Выключаем сниффинг для gRPC
        enableSockopt: true     // Включаем BBR/TFO, так как gRPC любит стабильный TCP
      }));
    } else if (form.network === 'xhttp') {
      setForm(prev => ({ ...prev, enableSockopt: true }));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
      <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
          <div className="flex items-center gap-4 text-slate-800">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
              <Cpu size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Xray Inbound Configurator</h2>
              <p className="text-[10px] font-bold text-indigo-500 uppercase">Версия ядра: v24.9.30+</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-200 rounded-full"><X /></button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex px-8 py-4 gap-2 bg-white border-b overflow-x-auto no-scrollbar">
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
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[11px] uppercase transition-all ${
                activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
          
          {/* TAB: BASE */}
          {activeTab === 'base' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Сетка основных параметров */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Tag (Уникальный)</label>
                  <input required className="w-full p-4 bg-white border border-slate-100 rounded-2xl font-bold text-sm focus:border-indigo-500 transition-all outline-none" value={form.tag} onChange={e => setForm({...form, tag: e.target.value})} placeholder="VLESS_REALITY" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Порт</label>
                  <input type="number" className="w-full p-4 bg-white border border-slate-100 rounded-2xl font-mono font-bold text-sm focus:border-indigo-500 transition-all outline-none" value={form.port} onChange={e => setForm({...form, port: parseInt(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">IP прослушивания</label>
                  <input className="w-full p-4 bg-white border border-slate-100 rounded-2xl font-mono text-sm focus:border-indigo-500 transition-all outline-none" value={form.listen} onChange={e => setForm({...form, listen: e.target.value})} />
                </div>
              </div>

              <hr className="border-slate-50" />

              {/* ВЫБОР ПРОТОКОЛА В СТИЛЕ КНОПОК */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Выбор протокола</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['vless', 'trojan', 'shadowsocks', 'vmess'].map((proto) => {
                    // Пока что блокируем vmess и shadowsocks, если они не реализованы в бэке
                    const isLocked = proto === 'shadowsocks' || proto === 'vmess';
                    
                    return (
                      <button
                        key={proto}
                        type="button"
                        disabled={isLocked}
                        onClick={() => setForm({ ...form, protocol: proto })}
                        className={`py-4 rounded-2xl font-black text-[11px] uppercase transition-all border ${
                          form.protocol === proto 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                            : 'bg-white text-slate-400 border-slate-100'
                        } ${isLocked ? 'opacity-20 cursor-not-allowed grayscale' : 'hover:border-indigo-200'}`}
                      >
                        {proto}
                        {isLocked && <span className="block text-[6px] mt-1 opacity-50">Soon</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* СПЕЦИФИЧНЫЕ НАСТРОЙКИ (Flow или Fallback) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Настройка Flow для VLESS */}
                {form.protocol === 'vless' && (
                  <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Default Flow</label>
                    <select 
                      className="w-full p-4 bg-white border border-indigo-50 rounded-2xl font-bold text-sm text-indigo-600 outline-none"
                      value={form.flow}
                      onChange={e => setForm({...form, flow: e.target.value})}
                    >
                      <option value="xtls-rprx-vision">XTLS Vision (Best)</option>
                      <option value="xtls-rprx-vision-udp443">XTLS Vision UDP443</option>
                      <option value="">None (Legacy)</option>
                    </select>
                  </div>
                )}

                {/* Настройка Fallback */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 flex justify-between">
                    Fallback Dest (HTTP)
                    {form.network === 'grpc' && <span className="text-amber-500 font-bold">Incompatible with gRPC</span>}
                  </label>
                  <input 
                    disabled={form.network === 'grpc'}
                    className={`w-full p-4 border rounded-2xl font-bold text-sm transition-all outline-none ${
                      form.network === 'grpc' 
                        ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed' 
                        : 'bg-white border-slate-100 text-slate-700 focus:border-indigo-500'
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
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Тип сети (Network Type)</label>
                <div className="grid grid-cols-4 gap-3">
                  {['raw', 'ws', 'grpc', 'xhttp'].map((net) => {
                    // Reality НЕ поддерживает WebSocket
                    const isDisabled = form.security === 'reality' && net === 'ws';
                    
                    return (
                      <button
                        key={net}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setForm({ ...form, network: net })}
                        className={`py-4 rounded-2xl font-black text-[11px] uppercase transition-all border ${
                          form.network === net 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' 
                            : 'bg-white text-slate-400 border-slate-100'
                        } ${isDisabled ? 'opacity-30 cursor-not-allowed bg-slate-50' : 'hover:border-indigo-200'}`}
                      >
                        {net === 'raw' ? 'TCP / RAW' : net.toUpperCase()}
                        {isDisabled && <span className="block text-[8px] text-amber-500 mt-1">Несовместимо с Reality</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Настройки для RAW */}
              {form.network === 'raw' && (
                <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                  {/* Proxy Protocol Switch */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <h4 className="text-sm font-bold text-slate-700">Accept Proxy Protocol</h4>
                      <p className="text-[10px] text-slate-400">Для работы через Nginx/HAProxy</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm({...form, acceptProxyProtocol: !form.acceptProxyProtocol})}
                      className={`w-12 h-6 rounded-full transition-colors relative ${form.acceptProxyProtocol ? 'bg-indigo-500' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${form.acceptProxyProtocol ? 'translate-x-6' : ''}`} />
                    </button>
                  </div>

                  {/* Header Type */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 flex justify-between">
                      Тип маскировки (Header Type)
                      {form.security === 'reality' && (
                        <span className="text-amber-500 normal-case font-medium">Reality требует 'none'</span>
                      )}
                    </label>
                    <select 
                      disabled={form.security === 'reality'}
                      className={`w-full p-4 rounded-2xl font-bold border transition-all ${
                        form.security === 'reality' 
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                        : 'bg-white text-indigo-600 border-indigo-50'
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
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300 md:col-span-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* WS PATH */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-indigo-400 uppercase ml-1 flex justify-between">
                        WS Path
                        <button 
                          type="button"
                          onClick={() => setForm({...form, wsPath: generateComplexPath()})}
                          className="text-indigo-600 hover:text-indigo-800 transition-colors lowercase font-bold"
                        >
                          + сгенерировать сложный путь
                        </button>
                      </label>
                      <div className="relative">
                        <input 
                          className="w-full p-4 bg-white border border-indigo-50 rounded-xl font-mono text-sm pr-10 focus:border-indigo-500 outline-none transition-all" 
                          value={form.wsPath} 
                          onChange={e => setForm({...form, wsPath: e.target.value})} 
                          placeholder="/secret-path" 
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
                          <Hash size={16} /> {/* Теперь иконка найдется */}
                        </div>
                      </div>
                    </div>

                    {/* WS HOST */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-indigo-400 uppercase ml-1">WS Host (SNI)</label>
                      <div className="relative">
                        <input 
                          className="w-full p-4 bg-white border border-indigo-50 rounded-xl font-mono text-sm pr-10 focus:border-indigo-500 outline-none transition-all" 
                          value={form.wsHost} 
                          onChange={e => setForm({...form, wsHost: e.target.value})} 
                          placeholder="example.com" 
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
                          <Globe size={16} /> {/* Можно добавить иконку глобуса для хоста */}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* gRPC Settings */}
              {form.network === 'grpc' && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300 md:col-span-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    
                    {/* Service Name */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-emerald-500 uppercase ml-1">Service Name (Path)</label>
                      <div className="relative">
                        <input 
                          className="w-full p-4 bg-white border border-indigo-50 rounded-xl font-mono text-sm pr-12" 
                          value={form.grpcServiceName} 
                          onChange={e => setForm({...form, grpcServiceName: e.target.value})} 
                          placeholder="Напр: SpeechService" 
                        />
                        <button 
                          type="button"
                          onClick={() => setForm({...form, grpcServiceName: getRandomGrpcService()})}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-indigo-400 hover:text-indigo-600 transition-colors"
                        >
                          <Zap size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Authority */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-emerald-500 uppercase ml-1">Authority (Domain)</label>
                      <input 
                        className="w-full p-4 bg-white border border-emerald-50 rounded-xl font-mono text-sm outline-none focus:border-emerald-500 transition-all" 
                        value={form.grpcAuthority} 
                        onChange={e => setForm({...form, grpcAuthority: e.target.value})} 
                        placeholder="example.com" 
                      />
                    </div>

                    {/* Multi Mode */}
                    <div className="flex items-center justify-between p-4 bg-white border border-emerald-50 rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-slate-600">Multi Mode</span>
                        <span className="text-[8px] text-slate-400">Поддержка нескольких сервисов</span>
                      </div>
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 accent-emerald-500"
                        checked={form.grpcMultiMode}
                        onChange={e => setForm({...form, grpcMultiMode: e.target.checked})}
                      />
                    </div>

                  </div>
                </div>
              )}
              

              {/* xHttp */}
              {form.network === 'xhttp' && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300 md:col-span-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* PATH */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-indigo-400 uppercase ml-1">Path</label>
                      <input 
                        className="w-full p-4 bg-white border border-indigo-50 rounded-xl font-mono text-sm outline-none focus:border-indigo-500 transition-all" 
                        value={form.xhttpPath} 
                        onChange={e => setForm({...form, xhttpPath: e.target.value})} 
                        placeholder="/WqGYA8..." 
                      />
                    </div>

                    {/* MODE (Оставили один, красивый) */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-indigo-400 uppercase ml-1">Mode</label>
                      <select 
                        className="w-full p-4 bg-white border border-indigo-50 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition-all"
                        value={form.xhttpMode}
                        onChange={e => setForm({...form, xhttpMode: e.target.value})}
                      >
                        <option value="stream-up">Stream Up (Fast)</option>
                        <option value="packet-up">Packet Up (Stealth)</option>
                      </select>
                    </div>

                    {/* PADDING */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-indigo-400 uppercase ml-1">Padding Bytes</label>
                      <input 
                        className="w-full p-4 bg-white border border-indigo-50 rounded-xl font-mono text-sm outline-none focus:border-indigo-500 transition-all" 
                        value={form.xhttpPadding} 
                        onChange={e => setForm({...form, xhttpPadding: e.target.value})} 
                        placeholder="100-1000" 
                      />
                    </div>

                  </div>
                  <p className="text-[8px] text-slate-400 px-1 italic">
                    * xHTTP — это новый высокопроизводительный транспорт. Настройки сокетов (BBR/TFO) доступны во вкладке "Sockopt".
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
                          ? 'bg-indigo-600 text-white border-indigo-600' 
                          : 'bg-white text-slate-400 border-slate-100'
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
                <div className="p-6 border-2 border-dashed border-slate-100 rounded-3xl text-center">
                  <p className="text-xs text-slate-400 font-medium">Трафик будет передаваться в открытом виде (рекомендуется только для внутренних сетей или за Nginx)</p>
                </div>
              )}
              
              {/* БЛОК: TLS (Стандартное шифрование) */}
              {form.security === 'tls' && (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Server Name (SNI)</label>
                      <input className="w-full p-4 bg-white border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500" 
                        value={form.tlsServerName} 
                        onChange={e => setForm({...form, tlsServerName: e.target.value})} 
                        placeholder="example.com" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">ALPN</label>
                      <input className="w-full p-4 bg-white border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-indigo-500" 
                        value={form.alpn} 
                        onChange={e => setForm({...form, alpn: e.target.value})} 
                        placeholder="h2,http/1.1" 
                      />
                    </div>
                  </div>

                  {/* Пути к сертификатам */}
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Путь к сертификату (.crt / .pem)</label>
                      <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-mono text-xs outline-none focus:border-indigo-500" 
                        value={form.tlsCertPath} 
                        onChange={e => setForm({...form, tlsCertPath: e.target.value})} 
                        placeholder="/etc/xray/fullchain.pem" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Путь к ключу (.key)</label>
                      <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-mono text-xs outline-none focus:border-indigo-500" 
                        value={form.tlsKeyPath} 
                        onChange={e => setForm({...form, tlsKeyPath: e.target.value})} 
                        placeholder="/etc/xray/privkey.pem" 
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-tight">Allow Insecure</h4>
                      <p className="text-[9px] text-slate-400">Игнорировать ошибки проверки сертификатов</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm({...form, allowInsecure: !form.allowInsecure})}
                      className={`w-10 h-5 rounded-full transition-colors relative ${form.allowInsecure ? 'bg-indigo-500' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${form.allowInsecure ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                </div>
              )}

              {form.security === 'reality' && (
                <div className="space-y-6 bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100">
                  <div className="flex justify-between items-center border-b border-indigo-100 pb-4">
                    <span className="font-black text-indigo-900 text-xs uppercase tracking-tighter">Reality Settings</span>
                    
                  </div>

                  {/* Основные цели */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-indigo-400 uppercase ml-1">Target (Dest)</label>
                      <input className="w-full p-4 bg-white rounded-xl border border-indigo-100 text-sm font-bold" 
                        placeholder="example.com:443" 
                        value={form.dest} 
                        onChange={e => {
                          const val = e.target.value;
                          // 1. Извлекаем чистый домен (убираем http://, https:// и :port)
                          const cleanDomain = val.replace(/^https?:\/\//, '').split(':')[0];
                          
                          // 2. Логика автозаполнения Server Names
                          let newServerNames = form.serverNames;
                          
                          // Если в домене есть точка (похоже на адрес) и поле еще не трогали вручную
                          if (cleanDomain.includes('.')) {
                            const baseDomain = cleanDomain.startsWith('www.') ? cleanDomain.substring(4) : cleanDomain;
                            const wwwDomain = `www.${baseDomain}`;
                            
                            // Формируем строку через запятую: "www.test.com, test.com"
                            newServerNames = `${wwwDomain}, ${baseDomain}`;
                          }

                          setForm({
                            ...form, 
                            dest: val,
                            serverNames: newServerNames
                          });
                        }} 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-indigo-400 uppercase ml-1">Spider X Path</label>
                      <input className="w-full p-4 bg-white rounded-xl border border-indigo-100 font-mono text-sm" placeholder="/" value={form.spiderX} onChange={e => setForm({...form, spiderX: e.target.value})} />
                    </div>
                  </div>

                  {/* Тонкие настройки маскировки */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[9px] font-black text-indigo-400 uppercase ml-1">Server Names</label>
                      <input className="w-full p-4 bg-white rounded-xl border border-indigo-100 text-sm" placeholder="example.com, www.example.com" value={form.serverNames} onChange={e => setForm({...form, serverNames: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-indigo-400 uppercase ml-1">Fingerprint</label>
                      <select className="w-full p-4 bg-white border border-indigo-100 rounded-xl font-bold text-sm" value={form.fingerprint} onChange={e => setForm({...form, fingerprint: e.target.value})}>
                        <option value="chrome">Chrome</option>
                        <option value="firefox">Firefox</option>
                        <option value="safari">Safari</option>
                        <option value="edge">Edge</option>
                        <option value="randomized">Randomized</option>
                      </select>
                    </div>
                    <div className="space-y-3 md:col-span-2">
                      <div className="flex justify-between items-end ml-1">
                        <label className="text-[9px] font-black text-indigo-400 uppercase">
                          Short IDs (через запятую или пробел)
                        </label>
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={() => {
                              const newId = generateShortId(8);
                              const current = form.shortIds ? form.shortIds + ', ' : '';
                              setForm({...form, shortIds: current + newId});
                            }}
                            className="text-[8px] font-black bg-indigo-100 text-indigo-600 px-2 py-1 rounded-md hover:bg-indigo-200 transition-all"
                          >
                            +8 HEX
                          </button>
                          <button 
                            type="button"
                            onClick={() => {
                              const newId = generateShortId(16);
                              const current = form.shortIds ? form.shortIds + ', ' : '';
                              setForm({...form, shortIds: current + newId});
                            }}
                            className="text-[8px] font-black bg-indigo-600 text-white px-2 py-1 rounded-md hover:shadow-md transition-all"
                          >
                            +16 HEX
                          </button>
                        </div>
                      </div>

                      <div className="relative group">
                        <textarea 
                          className="w-full p-4 bg-white rounded-2xl border border-indigo-100 font-mono text-xs min-h-[80px] focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none"
                          placeholder="Введите вручную или сгенерируйте..."
                          value={form.shortIds}
                          onChange={e => setForm({...form, shortIds: e.target.value})}
                        />
                        
                        {/* Индикатор количества */}
                        <div className="absolute bottom-3 right-3 flex gap-1">
                          {form.shortIds?.split(/[, ]+/).filter(id => id.length > 0).map((id, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full ${id.length === 16 ? 'bg-indigo-600' : 'bg-indigo-300'}`} title={`ID: ${id}`} />
                          ))}
                        </div>
                      </div>
                      
                      <p className="text-[8px] text-slate-400 px-1 italic">
                        * Можно вводить свои ID. Каждый ID должен быть в HEX (0-9, a-f) и иметь четную длину.
                      </p>
                    </div>
                    <div className="space-y-3">
                    <label className="text-[9px] font-black text-indigo-400 uppercase ml-1 flex justify-between">
                      Max Time Diff
                      <span className="text-[8px] normal-case font-medium text-slate-400">Допуск разницы времени (сек)</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="number"
                        className="w-full p-4 bg-white rounded-xl border border-indigo-100 font-bold text-sm outline-none focus:border-indigo-500 transition-all"
                        value={form.maxTimediff / 1000} // Показываем в секундах
                        onChange={e => {
                          const seconds = parseInt(e.target.value) || 0;
                          setForm({...form, maxTimediff: seconds * 1000}); // Сохраняем в мс
                        }}
                        placeholder="60"
                      />
                      <div className="text-[10px] font-bold text-indigo-300">SEC</div>
                    </div>
                    <p className="text-[8px] text-slate-400 px-1 leading-tight">
                      0 = по умолчанию (60с). Слишком маленькое значение требует идеальной синхронизации времени на клиенте.
                    </p>
                  </div>
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-indigo-100">
                    <div className="space-y-1">
                      <button type="button" onClick={handleGenerateKeys} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-[10px]">NEW KEYS</button>
                      <label className="text-[9px] font-black text-red-500 uppercase ml-1">Private Key (Обязательно)</label>
                      <input 
                        className={`w-full p-4 bg-white/50 rounded-xl font-mono text-[10px] border ${!form.privateKey ? 'border-red-300' : 'border-indigo-100'}`}
                        value={form.privateKey} 
                        readOnly 
                        placeholder="Нажмите NEW KEYS для генерации" 
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-red-500 uppercase ml-1">Public Key (Обязательно)</label>
                      <input 
                        className={`w-full p-4 bg-white rounded-xl font-mono text-[10px] border ${!form.publicKey ? 'border-red-300' : 'border-indigo-100'}`}
                        value={form.publicKey} 
                        onChange={e => setForm({...form, publicKey: e.target.value})} 
                        placeholder="Введите или сгенерируйте Public Key" 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: SNIFFING */}
          {activeTab === 'sniffing' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex items-center justify-between p-6 bg-slate-50 border rounded-3xl">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${form.sniffingEnabled ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'}`}><Search size={20}/></div>
                    <span className="font-black text-slate-700 uppercase text-xs">Включить Sniffing</span>
                  </div>
                  <input type="checkbox" className="w-6 h-6 rounded-lg border-slate-300" checked={form.sniffingEnabled} onChange={e => setForm({...form, sniffingEnabled: e.target.checked})} />
               </div>
               
               {form.sniffingEnabled && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3 p-6 bg-slate-50 border border-slate-100 rounded-4xl">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                        Dest Override (Sniffing Types)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {['http', 'tls', 'quic', 'fakedns'].map((type) => {
                          // Проверяем, выбрано ли значение (учитываем пробелы после запятой)
                          const selectedTypes = form.destOverride.split(',').map(t => t.trim());
                          const isChecked = selectedTypes.includes(type);

                          return (
                            <label 
                              key={type} 
                              className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                                isChecked 
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                                  : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-200'
                              }`}
                            >
                              <span className="text-[11px] font-black uppercase tracking-wider">{type}</span>
                              <input 
                                type="checkbox" 
                                className="hidden" 
                                checked={isChecked}
                                onChange={() => {
                                  let newTypes;
                                  if (isChecked) {
                                    // Удаляем значение
                                    newTypes = selectedTypes.filter(t => t !== type);
                                  } else {
                                    // Добавляем значение
                                    newTypes = [...selectedTypes, type];
                                  }
                                  // Сохраняем обратно как строку через запятую
                                  setForm({ ...form, destOverride: newTypes.filter(Boolean).join(', ') });
                                }}
                              />
                              {isChecked && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-2 p-6 bg-slate-50 border rounded-3xl">
                       <label className="text-[10px] font-black text-slate-400 uppercase">Domains Excluded  (через запятую)</label>
                       <input className="w-full p-4 bg-white border rounded-xl font-mono" value={form.domainsExcluded} onChange={e => setForm({...form, domainsExcluded: e.target.value})} />
                    </div>
                    <div className="space-y-4">
                       <label className="flex items-center gap-3 p-4 bg-slate-50 border rounded-2xl cursor-pointer">
                          <input type="checkbox" checked={form.metadataOnly} onChange={e => setForm({...form, metadataOnly: e.target.checked})} />
                          <span className="text-xs font-bold text-slate-500 uppercase">Metadata Only</span>
                       </label>
                       <label className="flex items-center gap-3 p-4 bg-slate-50 border rounded-2xl cursor-pointer">
                          <input type="checkbox" checked={form.routeOnly} onChange={e => setForm({...form, routeOnly: e.target.checked})} />
                          <span className="text-xs font-bold text-slate-500 uppercase">Route Only</span>
                       </label>
                    </div>
                 </div>
               )}
            </div>
          )}

          {/* TAB: SOCKOPT */}
          {activeTab === 'sockopt' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Master Switch */}
              <label className={`flex items-center justify-between p-6 rounded-4xl border-2 transition-all cursor-pointer ${form.enableSockopt ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${form.enableSockopt ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    <Zap size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-700 uppercase">Глобальные оптимизации</h3>
                    <p className="text-[10px] text-slate-500 font-medium">BBR, Fast Open и тонкая настройка стека TCP</p>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  className="w-6 h-6 accent-indigo-600"
                  checked={form.enableSockopt}
                  onChange={e => setForm({...form, enableSockopt: e.target.checked})}
                  disabled={form.network === 'xhttp'} // Блокируем выключение, если xhttp
                />
              </label>

              {/* Контент таба показываем только если включено */}
              {form.enableSockopt && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95 duration-200">
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">TCP Congestion (BBR)</label>
                  <select className="w-full p-4 bg-white border border-indigo-50 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all" value={form.tcpCongestion} onChange={e => setForm({...form, tcpCongestion: e.target.value})}>
                    <option value="bbr">BBR (Best Performance)</option>
                    <option value="cubic">CUBIC (Standard)</option>
                    <option value="reno">RENO</option>
                  </select>
              </div>
              
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">TProxy Mode</label>
                  <select className="w-full p-4 bg-white border border-slate-100 rounded-2xl font-bold text-sm outline-none" value={form.tproxy} onChange={e => setForm({...form, tproxy: e.target.value})}>
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
                    <label key={opt.key} className="flex flex-col gap-2 p-5 bg-white border border-slate-50 rounded-4xl cursor-pointer hover:border-indigo-200 transition-all group shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-700 uppercase">{opt.label}</span>
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 accent-indigo-600"
                          checked={(form as any)[opt.key]} 
                          onChange={e => setForm({...form, [opt.key]: e.target.checked})} 
                        />
                      </div>
                      <span className="text-[8px] text-slate-400 font-medium leading-none">{opt.desc}</span>
                    </label>
                  ))}
              </div>
              {/* ADVANCED TCP TUNING */}
              <div className="border-t border-slate-100 pt-6">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">
                  Advanced TCP Tuning (Тонкая настройка)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  
                  {/* TCP Max Segment */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 ml-1">TCP Max Seg</label>
                    <input 
                      type="number"
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-mono text-xs focus:bg-white transition-all"
                      value={form.tcpMaxSeg}
                      onChange={e => setForm({...form, tcpMaxSeg: Number(e.target.value)})}
                    />
                  </div>

                  {/* User Timeout */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 ml-1">User Timeout (ms)</label>
                    <input 
                      type="number"
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-mono text-xs focus:bg-white transition-all"
                      value={form.tcpUserTimeout}
                      onChange={e => setForm({...form, tcpUserTimeout: Number(e.target.value)})}
                    />
                  </div>

                  {/* Keep Alive Idle */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 ml-1">KeepAlive Idle (s)</label>
                    <input 
                      type="number"
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-mono text-xs focus:bg-white transition-all"
                      value={form.tcpKeepAliveIdle}
                      onChange={e => setForm({...form, tcpKeepAliveIdle: Number(e.target.value)})}
                    />
                  </div>

                  {/* Domain Strategy */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 ml-1">Domain Strategy</label>
                    <select 
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs"
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
                <p className="text-[8px] text-slate-400 mt-3 italic px-1">
                  * Эти параметры влияют на то, как пакеты упаковываются и удерживаются в сети. 1440/UseIP — стандарт для обхода DPI.
                </p>
              </div>
            </div>
              )}
            </div>
          )}
          {/* TAB: CLIENTS */}
          {activeTab === 'clients' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-slate-800 uppercase text-sm">Список пользователей</h3>
                <button 
                  type="button" 
                  onClick={() => setForm({
                    ...form, 
                    clients: [...form.clients, { 
                      uuid: crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`, 
                      email: "", 
                      flow: form.protocol === "vless" ? "xtls-rprx-vision" : "", 
                      level: 0,
                      alterId: 0,
                      security: "auto",
                      password: ""
                    }]
                  })}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-100"
                >
                  <Plus size={14} /> Добавить
                </button>
              </div>

              {form.clients.map((client, idx) => (
                <div key={idx} className="group relative p-6 bg-slate-50 border border-slate-100 rounded-4xl space-y-4 hover:border-indigo-200 transition-all">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Email / Имя</label>
                      <input 
                        className="w-full p-3 bg-white border rounded-xl font-bold text-sm" 
                        value={client.email} 
                        onChange={(e) => {
                          const c = [...form.clients];
                          c[idx].email = e.target.value;
                          setForm({...form, clients: c});
                        }} 
                        placeholder="user@example.com"
                      />
                    </div>
                    {/* Внутри цикла form.clients.map */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase">
                        {form.protocol === 'vless' ? 'UUID' : 'Пароль (Password)'}
                      </label>
                      <div className="flex gap-2">
                        <input 
                          className="flex-1 p-3 bg-white border rounded-xl font-mono text-sm" 
                          value={form.protocol === 'vless' ? client.uuid : client.password} 
                          onChange={(e) => {
                            const c = [...form.clients];
                            if (form.protocol === 'vless') c[idx].uuid = e.target.value;
                            else c[idx].password = e.target.value;
                            setForm({...form, clients: c});
                          }}
                        />
                        <button type="button" onClick={() => {
                          const c = [...form.clients];
                          if (form.protocol === 'vless') c[idx].uuid = generateUUID();
                          else c[idx].password = Math.random().toString(36).slice(-12);
                          setForm({...form, clients: c});
                        }} className="p-3 bg-white border rounded-xl hover:text-indigo-600"><Zap size={14}/></button>
                      </div>
                    </div>
                  </div>
                  
                  {/* НОВЫЕ ПОЛЯ: Flow и Level */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    {form.protocol === 'vless' && 
                    (form.security === 'reality' || form.security === 'tls') && 
                    form.network === 'raw' && ( // Добавляем проверку на RAW (TCP)
                      <div className="space-y-1 animate-in zoom-in-95 duration-200">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">
                          Client Flow
                        </label>
                        <select 
                          className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-indigo-600 outline-none"
                          value={client.flow}
                          onChange={(e) => {
                            const c = [...form.clients];
                            c[idx].flow = e.target.value;
                            setForm({...form, clients: c});
                          }}
                        >
                          <option value="">Наследовать (None)</option>
                          <option value="xtls-rprx-vision">XTLS Vision</option>
                          {/*<option value="xtls-rprx-vision-udp443">XTLS Vision UDP443</option>*/}
                        </select>
                      </div>
                    )}
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase">User Level</label>
                      <input 
                        type="number"
                        className="w-full p-3 bg-white border rounded-xl font-bold text-xs"
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
                      className="absolute -top-2 -right-2 p-2 bg-white shadow-md border border-red-50 text-red-400 rounded-full hover:text-red-600 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

        </form>

        {/* Footer */}
        <div className="p-8 bg-slate-50 border-t flex gap-4">
          <button onClick={handleClose} className="flex-1 py-4 font-black text-slate-400 uppercase tracking-widest hover:text-slate-600">Отмена</button>
          <button 
            onClick={handleSubmit} 
            disabled={loading || !isRealityValid() || !form.tag}
            className={`py-4 px-8 rounded-3xl font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 
              ${(loading || !isRealityValid() || !form.tag) 
                ? 'bg-slate-300 cursor-not-allowed text-slate-500' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-100'}`}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Сохранить конфигурацию"}
          </button>
        </div>
      </div>
    </div>
  );
}
