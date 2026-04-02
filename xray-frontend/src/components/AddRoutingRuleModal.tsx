// 1. Добавь useEffect в импорты
import { useState, useEffect } from "react"; 
import { X, Plus, ArrowRightLeft, Globe, Shield, Hash, Loader2, Info } from "lucide-react";
import { addRoutingRule } from "../api/outbound";
import { getInbounds } from "../api/inbound";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";

interface Props {
  isOpen: boolean;
  outbounds: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddRoutingRuleModal({ isOpen, outbounds, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  
  // States
  const [availableInbounds, setAvailableInbounds] = useState<any[]>([]);
  const [selectedInbounds, setSelectedInbounds] = useState<string[]>([]);
  const [outboundTag, setOutboundTag] = useState("");
  const [priority, setPriority] = useState(10);
  const [description, setDescription] = useState("");
  const [domainsRaw, setDomainsRaw] = useState("");
  const [ipsRaw, setIpsRaw] = useState("");
  const [port, setPort] = useState("");

  useEffect(() => {
    if (isOpen) {
      const fetchInbounds = async () => {
        try {
          const data = await getInbounds();
          setAvailableInbounds(Array.isArray(data) ? data : []);
        } catch (error) {
          console.error("Failed to fetch inbounds", error);
        }
      };
      fetchInbounds();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outboundTag) return toast.error("Выберите целевой шлюз");

    setLoading(true);

    // Парсим ввод
    const domain = domainsRaw.split('\n').map(d => d.trim()).filter(d => d !== "");
    const ip = ipsRaw.split('\n').map(i => i.trim()).filter(i => i !== "");

    const payload = {
      outbound_tag: outboundTag,
      domain: domain.length > 0 ? domain : null,
      ip: ip.length > 0 ? ip : null,
      // ИСПРАВЛЕНО: берем данные из массива выбранных чекбоксов
      inbound_tags: selectedInbounds.length > 0 ? selectedInbounds : null,
      port: port.trim() || null,
      priority: Number(priority),
      description: description.trim() || null,
      is_active: true
    };

    try {
      await addRoutingRule(payload);
      toast.success("Правило успешно добавлено");
      onSuccess();
      onClose();
      
      // Сброс полей
      setDomainsRaw("");
      setIpsRaw("");
      setPort("");
      setDescription("");
      setOutboundTag("");
      setSelectedInbounds([]); // Сбрасываем тут
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Ошибка при создании правила");
    } finally {
      setLoading(false);
    }
  };

  return (
  <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
    <div className="bg-main border border-line w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
      
      {/* Header */}
      <div className="p-8 border-b border-line flex justify-between items-center bg-card/30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-900/40">
            <ArrowRightLeft size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-base">
              {t("routing.newRoute")}<span className="text-indigo-500">.</span>
            </h2>
            <p className="text-[10px] font-black text-muted uppercase tracking-widest mt-0.5 italic">
              {t("routing.steeringLogic")}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-3 hover:bg-card rounded-2xl text-muted transition-colors">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-8 overflow-y-auto custom-scrollbar space-y-6">
        
        {/* Target & Priority */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">
              {t("routing.targetOutbound")}
            </label>
            <select 
              required
              value={outboundTag}
              onChange={(e) => setOutboundTag(e.target.value)}
              className="w-full bg-card border border-line rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="">{t("routing.selectGateway")}</option>
              {outbounds.map(out => (
                <option key={out.id} value={out.tag}>{out.tag.toUpperCase()} ({out.protocol})</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">
              {t("routing.priorityLabel")}
            </label>
            <input 
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full bg-card border border-line rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* Source Inbounds Selection */}
        <div className="space-y-3">
          <div className="flex justify-between items-center ml-1">
            <label className="text-[10px] font-black uppercase text-muted tracking-widest flex items-center gap-2">
              <Shield size={12} className="text-indigo-500" /> {t("routing.sourceInbounds")}
            </label>
            <span className="text-[8px] font-black text-muted/50 uppercase tracking-tighter">
              {selectedInbounds.length} {t("common.selected")}
            </span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-card/30 border border-line rounded-[2rem] max-h-[200px] overflow-y-auto custom-scrollbar">
            {availableInbounds.length > 0 ? (
              availableInbounds.map((inbound) => {
                const isSelected = selectedInbounds.includes(inbound.tag);
                return (
                  <button
                    key={inbound.id}
                    type="button"
                    onClick={() => {
                      setSelectedInbounds(prev => 
                        isSelected ? prev.filter(t => t !== inbound.tag) : [...prev, inbound.tag]
                      );
                    }}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                      isSelected 
                      ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.1)]" 
                      : "border-line bg-main/50 hover:border-indigo-500/50"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-line bg-card"
                    }`}>
                      {isSelected && <Plus size={12} />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[10px] font-black uppercase truncate ${isSelected ? "text-base" : "text-muted"}`}>
                        {inbound.tag}
                      </p>
                      <p className="text-[8px] font-bold text-muted/50 uppercase leading-none">{inbound.protocol}</p>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="col-span-full py-8 text-center">
                <p className="text-[10px] font-black text-muted uppercase tracking-widest italic opacity-50">
                  {t("routing.noInbounds")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Domains Filters */}
        <div className="space-y-2">
          <div className="flex justify-between items-center ml-1">
            <label className="text-[10px] font-black uppercase text-muted tracking-widest flex items-center gap-2">
              <Globe size={12} className="text-indigo-500" /> {t("routing.domainsFilters")}
            </label>
            <span className="text-[8px] font-black text-muted/50 uppercase tracking-tighter">{t("common.onePerLine")}</span>
          </div>
          <textarea 
            placeholder="google.com&#10;geosite:category-ads-all"
            value={domainsRaw}
            onChange={(e) => setDomainsRaw(e.target.value)}
            rows={3}
            className="w-full bg-card border border-line rounded-[1.5rem] px-5 py-4 text-xs font-mono font-bold focus:border-indigo-500 outline-none resize-none custom-scrollbar"
          />
        </div>

        {/* IPs & Ports */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1 flex items-center gap-2">
              <Shield size={12} className="text-emerald-500" /> {t("routing.ipFilters")}
            </label>
            <textarea 
              placeholder="1.1.1.1&#10;geoip:private"
              value={ipsRaw}
              onChange={(e) => setIpsRaw(e.target.value)}
              rows={3}
              className="w-full bg-card border border-line rounded-[1.5rem] px-5 py-4 text-xs font-mono font-bold focus:border-indigo-500 outline-none resize-none custom-scrollbar"
            />
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1 flex items-center gap-2">
                <Hash size={12} className="text-amber-500" /> {t("routing.ports")}
              </label>
              <input 
                placeholder="53, 80, 443"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full bg-card border border-line rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex gap-3">
              <Info size={16} className="text-indigo-500 shrink-0" />
              <p className="text-[9px] font-medium leading-relaxed text-muted italic">
                {t("routing.emptyFieldsInfo")}
              </p>
            </div>
          </div>
        </div>

        {/* Comment */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">{t("common.comment")}</label>
          <input 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("routing.commentPlaceholder")}
            className="w-full bg-card border border-line rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 outline-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex gap-4">
          <button type="button" onClick={onClose} className="flex-1 px-6 py-5 border border-line rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-card transition-all">
            {t("common.cancel")}
          </button>
          <button disabled={loading} className="flex-[2] px-6 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-900/40 transition-all flex items-center justify-center gap-2">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            {t("routing.createRule")}
          </button>
        </div>
      </form>
    </div>
  </div>
);
}