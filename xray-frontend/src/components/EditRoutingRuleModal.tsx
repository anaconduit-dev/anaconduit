import { useState, useEffect } from "react";
import { X, Save, Loader2, Globe, Shield, Hash } from "lucide-react";
import { updateRoutingRule } from "../api/outbound";
import { toast } from "react-hot-toast";

export default function EditRoutingRuleModal({ isOpen, onClose, onSuccess, rule, outbounds }: any) {
  const [loading, setLoading] = useState(false);
  
  // Состояния полей
  const [priority, setPriority] = useState(10);
  const [outboundTag, setOutboundTag] = useState("");
  const [description, setDescription] = useState("");
  const [domain, setDomain] = useState("");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("");

  useEffect(() => {
    if (isOpen && rule) {
      setPriority(rule.priority ?? 10);
      setOutboundTag(rule.outbound_tag || "");
      setDescription(rule.description || "");
      // Превращаем массивы обратно в строки через запятую для инпутов
      setDomain(Array.isArray(rule.domain) ? rule.domain.join(", ") : "");
      setIp(Array.isArray(rule.ip) ? rule.ip.join(", ") : "");
      setPort(rule.port || "");
    }
  }, [isOpen, rule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      priority: Number(priority),
      outbound_tag: outboundTag,
      description: description.trim() || null,
      // Превращаем строки обратно в массивы, чистим пробелы
      domain: domain ? domain.split(",").map(d => d.trim()).filter(d => d !== "") : null,
      ip: ip ? ip.split(",").map(i => i.trim()).filter(i => i !== "") : null,
      port: port.toString().trim() || null,
      is_active: rule.is_active
    };

    try {
      await updateRoutingRule(rule.id, payload);
      toast.success("Rule updated successfully");
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Update error");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-main border border-line w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-8 border-b border-line flex justify-between items-center bg-card/30">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">Edit Rule<span className="text-indigo-500">.</span></h2>
            <span className="text-[10px] text-muted font-bold tracking-widest uppercase">ID: {rule?.id}</span>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-card rounded-2xl text-muted transition-colors"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto custom-scrollbar space-y-5">
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Priority</label>
              <input type="number" required value={priority} onChange={e => setPriority(Number(e.target.value))} className="w-full bg-card border border-line rounded-2xl px-5 py-3 text-sm font-bold focus:border-indigo-500 outline-none" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Target Gateway</label>
              <select required value={outboundTag} onChange={e => setOutboundTag(e.target.value)} className="w-full bg-card border border-line rounded-2xl px-5 py-3 text-sm font-bold focus:border-indigo-500 outline-none cursor-pointer">
                <option value="" disabled>Select Outbound</option>
                {outbounds.map((out: any) => (
                  <option key={out.id} value={out.tag}>{out.tag.toUpperCase()} ({out.protocol})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-6 bg-card/50 border border-line rounded-[2rem] space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1 flex items-center gap-2">
                <Globe size={12} className="text-indigo-500" /> Domains
              </label>
              <input placeholder="google.com, .ru, domain:example.com" value={domain} onChange={e => setDomain(e.target.value)} className="w-full bg-main border border-line rounded-xl px-5 py-3 text-xs font-bold outline-none focus:border-indigo-500" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1 flex items-center gap-2">
                <Shield size={12} className="text-emerald-500" /> IP Addresses
              </label>
              <input placeholder="1.1.1.1, 192.168.1.0/24, geoip:private" value={ip} onChange={e => setIp(e.target.value)} className="w-full bg-main border border-line rounded-xl px-5 py-3 text-xs font-bold outline-none focus:border-emerald-500" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1 flex items-center gap-2">
                <Hash size={12} className="text-amber-500" /> Ports
              </label>
              <input placeholder="80, 443, 1000-2000" value={port} onChange={e => setPort(e.target.value)} className="w-full bg-main border border-line rounded-xl px-5 py-3 text-xs font-bold outline-none focus:border-amber-500" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">Description (Internal Note)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full bg-card border border-line rounded-2xl px-5 py-3 text-sm font-bold focus:border-indigo-500 outline-none resize-none" />
          </div>

          <div className="pt-4 flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 border border-line rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-card transition-all">Cancel</button>
            <button disabled={loading} className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Update Rule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}