import { useState, useEffect } from "react";
import { X, Save, ArrowRightLeft, Loader2, Key, Server, Lock, Wand2, Zap, Anchor, ShieldCheck, Globe } from "lucide-react";
import { addOutbound, getOutbounds } from "../api/outbound";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";

export default function AddOutboundModal({ isOpen, onClose, onSuccess }: any) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [availableOutbounds, setAvailableOutbounds] = useState<any[]>([]);
  const [importUrl, setImportUrl] = useState("");

  // Основные поля
  const [tag, setTag] = useState("");
  const [protocol, setProtocol] = useState("freedom");
  const [proxyTag, setProxyTag] = useState("");
  const [description, setDescription] = useState("");

  // Параметры сервера
  const [address, setAddress] = useState("");
  const [port, setPort] = useState(443);
  const [uuid, setUuid] = useState("");
  const [password, setPassword] = useState("");
  const [sni, setSni] = useState("");
  const [fingerprint, setFingerprint] = useState("chrome");

  // Reality Специфично
  const [security, setSecurity] = useState("none"); 
  const [publicKey, setPublicKey] = useState("");
  const [shortId, setShortId] = useState("");
  const [flow, setFlow] = useState("");

  useEffect(() => {
    if (isOpen) {
      getOutbounds().then(data => setAvailableOutbounds(Array.isArray(data) ? data : []));
    }
  }, [isOpen]);

  const handleImport = () => {
    try {
      const url = new URL(importUrl);
      const params = new URLSearchParams(url.search);

      if (url.protocol === "vless:") setProtocol("vless");
      if (url.protocol === "trojan:") setProtocol("trojan");

      setAddress(url.hostname);
      setPort(Number(url.port) || 443);
      setUuid(url.username);
      setPassword(url.username);
      
      setSni(params.get("sni") || "");
      setFingerprint(params.get("fp") || "chrome");
      setSecurity(params.get("security") || "none");
      setPublicKey(params.get("pbk") || "");
      setShortId(params.get("sid") || "");
      setFlow(params.get("flow") || "");
      
      if (url.hash) setTag(decodeURIComponent(url.hash.substring(1)));
      
      toast.success("Import successful!");
      setImportUrl("");
    } catch (e) {
      toast.error("Invalid link format");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let settings: any = {};
    let streamSettings: any = null;

    if (protocol === "vless" || protocol === "trojan") {
      if (protocol === "vless") {
        settings = { vnext: [{ address, port, users: [{ id: uuid, encryption: "none", flow }] }] };
      } else {
        settings = { servers: [{ address, port, password }] };
      }

      if (security !== "none") {
        streamSettings = {
          network: "tcp",
          security: security,
          [`${security}Settings`]: {
            serverName: sni || address,
            fingerprint: fingerprint,
            ...(security === "reality" ? { publicKey, shortId, show: false } : {})
          }
        };
      }
    } else if (protocol === "socks") {
      settings = { servers: [{ address, port }] };
    } else if (protocol === "blackhole") {
      settings = {
        response: {
          type: "none" 
        }
      };
    }

    const payload = {
      tag: tag.trim(),
      protocol,
      description: description.trim() || null,
      settings,
      stream_settings: streamSettings,
      proxy_settings: proxyTag ? { tag: proxyTag } : {},
      is_active: true
    };

    try {
      await addOutbound(payload);
      toast.success(t("outbounds.addSuccess") || "Added!");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Error");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-main border border-line w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-8 border-b border-line flex justify-between items-center bg-card/30">
          <h2 className="text-2xl font-black uppercase italic tracking-tighter">New Gateway<span className="text-indigo-500">.</span></h2>
          <button onClick={onClose} className="p-3 hover:bg-card rounded-2xl text-muted transition-colors"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto custom-scrollbar space-y-6">
          
          {/* MAGIC IMPORT */}
          <div className="relative group">
            <input 
              value={importUrl} 
              onChange={e => setImportUrl(e.target.value)}
              placeholder="Paste vless:// or trojan:// link..."
              className="w-full bg-indigo-500/5 border border-indigo-500/20 rounded-2xl px-5 py-4 text-xs font-bold focus:border-indigo-500 outline-none transition-all pr-16"
            />
            <button type="button" onClick={handleImport} className="absolute right-2 top-2 bottom-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all flex items-center gap-2">
              <Wand2 size={14} /> <span className="text-[10px] font-black uppercase tracking-widest">Import</span>
            </button>
          </div>

          {/* TAG & PROTOCOL */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Tag</label>
              <input required value={tag} onChange={e => setTag(e.target.value)} className="w-full bg-card border border-line rounded-2xl px-5 py-3 text-sm font-bold focus:border-indigo-500 outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Protocol</label>
              <select value={protocol} onChange={e => setProtocol(e.target.value)} className="w-full bg-card border border-line rounded-2xl px-5 py-3 text-sm font-bold outline-none cursor-pointer appearance-none">
                <option value="freedom">Freedom (Direct)</option>
                <option value="blackhole">Blackhole (Block)</option>
                <option value="vless">VLESS</option>
                <option value="trojan">Trojan</option>
                <option value="socks">SOCKS</option>
              </select>
            </div>
          </div>

          {/* PROXY CHAIN - ВОЗВРАЩЕНО */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1 flex items-center gap-2">
              <ArrowRightLeft size={12} className="text-indigo-500" /> Proxy Chain (Optional)
            </label>
            <select value={proxyTag} onChange={e => setProxyTag(e.target.value)} className="w-full bg-card border border-line rounded-2xl px-5 py-3 text-sm font-bold focus:border-indigo-500 outline-none cursor-pointer">
              <option value="">Direct Internet Access</option>
              {availableOutbounds.filter(o => o.tag !== tag).map(out => (
                <option key={out.id} value={out.tag}>Route via {out.tag.toUpperCase()} ({out.protocol})</option>
              ))}
            </select>
          </div>

          {/* DYNAMIC SETTINGS */}
          {(protocol === "vless" || protocol === "trojan" || protocol === "socks") && (
            <div className="p-6 bg-card/50 border border-line rounded-[2rem] space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 mb-2">
                <SettingsIcon protocol={protocol} />
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Connection Info</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-[8px] font-black uppercase text-muted">Server Address</label>
                  <div className="relative">
                    <Server className="absolute left-3 top-2.5 text-muted" size={14} />
                    <input required value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-main border border-line rounded-xl pl-10 pr-4 py-2 text-xs font-bold outline-none" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-muted">Port</label>
                  <input type="number" value={port} onChange={e => setPort(Number(e.target.value))} className="w-full bg-main border border-line rounded-xl px-4 py-2 text-xs font-bold outline-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase text-muted">{protocol === "vless" ? "UUID" : "Password"}</label>
                <div className="relative">
                   {protocol === "vless" ? <Key className="absolute left-3 top-2.5 text-muted" size={14} /> : <Lock className="absolute left-3 top-2.5 text-muted" size={14} />}
                   <input required value={protocol === "vless" ? uuid : password} onChange={e => protocol === "vless" ? setUuid(e.target.value) : setPassword(e.target.value)} className="w-full bg-main border border-line rounded-xl pl-10 pr-4 py-2 text-xs font-bold outline-none" />
                </div>
              </div>

              {protocol !== "socks" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-muted">Security</label>
                      <select value={security} onChange={e => setSecurity(e.target.value)} className="w-full bg-main border border-line rounded-xl px-4 py-2 text-[10px] font-bold outline-none">
                        <option value="none">None</option>
                        <option value="tls">TLS</option>
                        <option value="reality">REALITY</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-muted">Fingerprint</label>
                      <select value={fingerprint} onChange={e => setFingerprint(e.target.value)} className="w-full bg-main border border-line rounded-xl px-4 py-2 text-[10px] font-bold outline-none">
                        <option value="chrome">Chrome</option>
                        <option value="firefox">Firefox</option>
                        <option value="safari">Safari</option>
                      </select>
                    </div>
                  </div>

                  {security === "reality" && (
                    <div className="space-y-3 pt-2 border-t border-line/30 animate-fadeIn">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-muted">Public Key (pbk)</label>
                        <input value={publicKey} onChange={e => setPublicKey(e.target.value)} className="w-full bg-main border border-line rounded-xl px-4 py-2 text-[10px] font-bold outline-none focus:border-indigo-500" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-muted">Short ID (sid)</label>
                          <input value={shortId} onChange={e => setShortId(e.target.value)} className="w-full bg-main border border-line rounded-xl px-4 py-2 text-[10px] font-bold outline-none" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-muted">Flow</label>
                          <input value={flow} onChange={e => setFlow(e.target.value)} placeholder="xtls-rprx-vision" className="w-full bg-main border border-line rounded-xl px-4 py-2 text-[10px] font-bold outline-none" />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full bg-card border border-line rounded-2xl px-5 py-3 text-sm font-bold focus:border-indigo-500 outline-none resize-none" />
          </div>

          <div className="pt-4 flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 border border-line rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-card transition-all">Cancel</button>
            <button disabled={loading} className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Gateway
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SettingsIcon({ protocol }: { protocol: string }) {
  if (protocol === 'freedom') return <Zap size={14} />;
  if (protocol === 'socks' || protocol === 'vless' || protocol === 'trojan') return <Anchor size={14} />;
  if (protocol === 'blackhole') return <ShieldCheck size={14} />;
  return <Globe size={14} />;
}