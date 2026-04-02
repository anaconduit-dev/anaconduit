import { useState, useEffect } from "react"; 
import { X, Plus, ArrowRightLeft, Globe, Shield, Hash, Loader2, Info, User, ChevronDown } from "lucide-react";
import { addRoutingRule } from "../api/outbound";
import { getInbounds } from "../api/inbound";
import { getUsers } from "../api/user"; 
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
  
  const [availableInbounds, setAvailableInbounds] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedInbounds, setSelectedInbounds] = useState<string[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [expandedUsers, setExpandedUsers] = useState<number[]>([]);
  const [outboundTag, setOutboundTag] = useState("");
  const [priority, setPriority] = useState(10);
  const [description, setDescription] = useState("");
  const [domainsRaw, setDomainsRaw] = useState("");
  const [ipsRaw, setIpsRaw] = useState("");
  const [port, setPort] = useState("");

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          const [inboundsData, usersData] = await Promise.all([
            getInbounds(),
            getUsers()
          ]);
          setAvailableInbounds(Array.isArray(inboundsData) ? inboundsData : []);
          setAvailableUsers(Array.isArray(usersData) ? usersData : []);
        } catch (error) {
          console.error(t("routing.failedData"), error);
        }
      };
      fetchData();
    }
  }, [isOpen]);

  const toggleUserExpansion = (userId: number) => {
    setExpandedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outboundTag) return toast.error(t("routing.selectGateway"));

    setLoading(true);

    const payload = {
      outbound_tag: outboundTag,
      domain: domainsRaw.split('\n').map(d => d.trim()).filter(Boolean),
      ip: ipsRaw.split('\n').map(i => i.trim()).filter(Boolean),
      inbound_tags: selectedInbounds.length > 0 ? selectedInbounds : null,
      client_emails: selectedEmails.length > 0 ? selectedEmails : null, // user#tag
      port: port.trim() || null,
      priority: Number(priority),
      description: description.trim() || null,
      is_active: true
    };

    try {
      await addRoutingRule(payload);
      toast.success(t("routing.ruleAdded"));
      
      
      setDomainsRaw("");
      setIpsRaw("");
      setPort("");
      setDescription("");
      setOutboundTag("");
      setSelectedInbounds([]);
      setSelectedEmails([]);
      
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || t("routing.errorCreating"));
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

        {/* Source Inbounds */}
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1 flex items-center gap-2">
            <Shield size={12} className="text-indigo-500" /> {t("routing.sourceInbounds")}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {availableInbounds.map((inbound) => {
              const isSelected = selectedInbounds.includes(inbound.tag);
              return (
                <button
                  key={inbound.id}
                  type="button"
                  onClick={() => setSelectedInbounds(prev => isSelected ? prev.filter(t => t !== inbound.tag) : [...prev, inbound.tag])}
                  className={`p-3 rounded-xl border text-[10px] font-black uppercase transition-all ${
                    isSelected ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-900/20" : "bg-card border-line text-muted hover:border-indigo-500/50"
                  }`}
                >
                  {inbound.tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* --- USER ROUTING (COLLAPSIBLE) --- */}
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1 flex items-center gap-2">
            <User size={12} className="text-emerald-500" /> {t("routing.usersRouting")}
          </label>
          
          <div className="space-y-2 p-4 bg-card/30 border border-line rounded-[2.5rem] max-h-[350px] overflow-y-auto custom-scrollbar">
            {availableUsers.map(user => {
              const isExpanded = expandedUsers.includes(user.id);
              const userEmailPairs = user.clients.map((c: any) => `${user.email.toLowerCase()}#${c.inbound.tag}`);
              const selectedFromUser = userEmailPairs.filter((pair: string) => selectedEmails.includes(pair));

              return (
                <div key={user.id} className="bg-main/40 border border-line/50 rounded-[1.8rem] overflow-hidden transition-all">
                  {/* Card Header */}
                  <div 
                    onClick={() => toggleUserExpansion(user.id)}
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-card/50 transition-colors"
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${selectedFromUser.length > 0 ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 text-emerald-500'}`}>
                      <User size={12} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase tracking-tight">{user.email}</span>
                      {selectedFromUser.length > 0 && (
                        <span className="text-[8px] font-bold text-emerald-500 uppercase leading-none">
                          {t("routing.selectedCount", { count: selectedFromUser.length })}
                        </span>
                      )}
                    </div>

                    <div className="ml-auto flex items-center gap-4">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const allSelected = userEmailPairs.every((tag: string) => selectedEmails.includes(tag));
                          if (allSelected) {
                            setSelectedEmails(prev => prev.filter(e => !userEmailPairs.includes(e)));
                          } else {
                            setSelectedEmails(prev => Array.from(new Set([...prev, ...userEmailPairs])));
                          }
                        }}
                        className="text-[8px] font-black uppercase text-indigo-500 hover:text-indigo-400"
                      >
                        {userEmailPairs.every((tag: string) => selectedEmails.includes(tag)) ? "Deselect" : "Select All"}
                      </button>
                      <ChevronDown size={14} className={`text-muted transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 animate-fadeIn">
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line/30">
                        {user.clients.map((client: any) => {
                          const xrayEmail = `${user.email.toLowerCase()}#${client.inbound.tag}`;
                          const isSelected = selectedEmails.includes(xrayEmail);
                          return (
                            <button
                              key={client.id}
                              type="button"
                              onClick={() => setSelectedEmails(prev => 
                                isSelected ? prev.filter(e => e !== xrayEmail) : [...prev, xrayEmail]
                              )}
                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                                isSelected ? "border-emerald-500 bg-emerald-500/10" : "border-line/50 bg-card/50"
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? "bg-emerald-500 border-emerald-500 text-white" : "border-line"}`}>
                                {isSelected && <Plus size={10} />}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-[9px] font-black uppercase truncate ${isSelected ? "text-emerald-400" : "text-muted"}`}>{client.inbound.tag}</p>
                                <p className="text-[7px] font-bold opacity-30 uppercase">{client.inbound.protocol}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Domains Filters */}
        <div className="space-y-2">
          <div className="flex justify-between items-center ml-1">
            <label className="text-[10px] font-black uppercase text-muted tracking-widest flex items-center gap-2">
              <Globe size={12} className="text-indigo-500" /> {t("routing.domainsFilters")}
            </label>
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
            <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex gap-3">
              <Info size={14} className="text-indigo-500 shrink-0" />
              <p className="text-[8px] font-medium leading-tight text-muted italic">
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