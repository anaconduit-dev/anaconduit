import { useState, useEffect, useMemo } from "react";
import { X, Save, Loader2, Shield, User, Plus, Cpu } from "lucide-react";
import { updateRoutingRule } from "../api/outbound";
import { getInbounds } from "../api/inbound";
import { getUsers } from "../api/user"; 
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";

export default function EditRoutingRuleModal({ isOpen, onClose, onSuccess, rule, outbounds }: any) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [availableInbounds, setAvailableInbounds] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  
  // --- Состояния формы ---
  const [selectedInbounds, setSelectedInbounds] = useState<string[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]); 
  const [priority, setPriority] = useState(10);
  const [outboundTag, setOutboundTag] = useState("");
  const [description, setDescription] = useState("");
  const [domainsRaw, setDomainsRaw] = useState("");
  const [ipsRaw, setIpsRaw] = useState("");
  const [port, setPort] = useState("");
  const [expandedUsers, setExpandedUsers] = useState<number[]>([]);

  // --- 1. ФИЛЬТРАЦИЯ ДАННЫХ ПО НОДЕ ПРАВИЛА ---
  
  // Фильтруем оутбоунды (те, что пришли в пропсах)
  const filteredOutbounds = useMemo(() => {
    if (!rule) return [];
    return outbounds.filter((out: any) => out.node_id === rule.node_id);
  }, [outbounds, rule]);

  // Фильтруем инбаунды
  const filteredInbounds = useMemo(() => {
    if (!rule) return [];
    return availableInbounds.filter((ib: any) => ib.node_id === rule.node_id);
  }, [availableInbounds, rule]);

  // Список тегов инбаундов на этой ноде (для фильтрации клиентов пользователей)
  const nodeInboundTags = useMemo(() => {
    return new Set(filteredInbounds.map(ib => ib.tag));
  }, [filteredInbounds]);

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          const [inbounds, users] = await Promise.all([getInbounds(), getUsers()]);
          setAvailableInbounds(Array.isArray(inbounds) ? inbounds : []);
          setAvailableUsers(Array.isArray(users) ? users : []);
        } catch (error) {
          console.error(t("routing.failedData"), error);
        }
      };
      fetchData();
    }
  }, [isOpen, t]);

  useEffect(() => {
    if (isOpen && rule) {
      setPriority(rule.priority ?? 10);
      setOutboundTag(rule.outbound_tag || "");
      setDescription(rule.description || "");
      setPort(rule.port || "");
      setDomainsRaw(Array.isArray(rule.domain) ? rule.domain.join("\n") : "");
      setIpsRaw(Array.isArray(rule.ip) ? rule.ip.join("\n") : "");
      setSelectedInbounds(Array.isArray(rule.inbound_tags) ? rule.inbound_tags : []);
      setSelectedEmails(Array.isArray(rule.client_emails) ? rule.client_emails : []);
    }
  }, [isOpen, rule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      priority: Number(priority),
      outbound_tag: outboundTag,
      description: description.trim() || null,
      domain: domainsRaw.split('\n').map(d => d.trim()).filter(Boolean),
      ip: ipsRaw.split('\n').map(i => i.trim()).filter(Boolean),
      inbound_tags: selectedInbounds.length > 0 ? selectedInbounds : null,
      client_emails: selectedEmails.length > 0 ? selectedEmails : null,
      port: port.toString().trim() || null,
      is_active: rule.is_active
    };

    try {
      await updateRoutingRule(rule.id, payload);
      toast.success(t("routing.ruleUpdated"));
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Update error");
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (userId: number) => {
    setExpandedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-main border border-line w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="p-8 border-b border-line flex justify-between items-center bg-card/30">
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">
              {t("routing.editRoute")}<span className="text-indigo-500">.</span>
            </h2>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-[10px] text-muted font-bold tracking-widest uppercase italic">ID: {rule?.id}</span>
               <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md font-black uppercase flex items-center gap-1">
                 <Cpu size={8} /> Node {rule?.node_id || 'Master'}
               </span>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-card rounded-2xl text-muted transition-colors"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto custom-scrollbar space-y-6">
          
          {/* Outbound & Priority */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">{t("routing.targetOutbound")}</label>
              <select 
                value={outboundTag} 
                onChange={e => setOutboundTag(e.target.value)} 
                className="w-full bg-card border border-line rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 outline-none appearance-none cursor-pointer"
              >
                {filteredOutbounds.map((out: any) => (
                  <option key={out.id} value={out.tag}>{out.tag.toUpperCase()} ({out.protocol})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1">{t("routing.priorityLabel")}</label>
              <input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))} className="w-full bg-card border border-line rounded-2xl px-5 py-4 text-sm font-bold focus:border-indigo-500 outline-none" />
            </div>
          </div>

          {/* Source Inbounds (Filtered) */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1 flex items-center gap-2">
              <Shield size={12} className="text-indigo-500" /> {t("routing.sourceInbounds")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {filteredInbounds.map(ib => {
                const isSelected = selectedInbounds.includes(ib.tag);
                return (
                  <button 
                    key={ib.id} 
                    type="button" 
                    onClick={() => setSelectedInbounds(prev => isSelected ? prev.filter(t => t !== ib.tag) : [...prev, ib.tag])}
                    className={`p-2 rounded-xl border text-[10px] font-black uppercase transition-all ${
                      isSelected ? "bg-indigo-500 border-indigo-500 text-white shadow-lg" : "bg-card border-line text-muted hover:border-indigo-500/50"
                    }`}
                  >
                    {ib.tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* User Routing (Filtered by Node) */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-muted tracking-widest ml-1 flex items-center gap-2">
              <User size={12} className="text-emerald-500" /> {t("routing.usersRouting")}
            </label>
            
            <div className="space-y-2 p-4 bg-card/30 border border-line rounded-[2.5rem] max-h-[400px] overflow-y-auto custom-scrollbar">
              {availableUsers.map(user => {
                // ПОКАЗЫВАЕМ ТОЛЬКО ТЕ ПОДКЛЮЧЕНИЯ, КОТОРЫЕ НА ЭТОЙ НОДЕ
                const nodeSpecificClients = user.clients.filter((c: any) => nodeInboundTags.has(c.inbound.tag));
                
                // Если у пользователя нет подключений на этой ноде — скрываем его из списка для этого правила
                if (nodeSpecificClients.length === 0) return null;

                const isExpanded = expandedUsers.includes(user.id);
                const userEmailsOnNode = nodeSpecificClients.map((c: any) => `${user.email.toLowerCase()}#${c.inbound.tag}`);
                const selectedCount = userEmailsOnNode.filter((email: string) => selectedEmails.includes(email)).length;

                return (
                  <div key={user.id} className="bg-main/40 border border-line/50 rounded-[1.8rem] overflow-hidden transition-all">
                    <div 
                      onClick={() => toggleUser(user.id)}
                      className="flex items-center gap-2 p-4 cursor-pointer hover:bg-card/50 transition-colors"
                    >
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${selectedCount > 0 ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        <User size={12} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black uppercase tracking-tight">{user.email}</span>
                        {selectedCount > 0 && <span className="text-[8px] font-bold text-emerald-500 uppercase">Selected: {selectedCount}</span>}
                      </div>

                      <div className="ml-auto flex items-center gap-4">
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const allSelected = userEmailsOnNode.every((tag: string) => selectedEmails.includes(tag));
                            if (allSelected) {
                              setSelectedEmails(prev => prev.filter(e => !userEmailsOnNode.includes(e)));
                            } else {
                              setSelectedEmails(prev => Array.from(new Set([...prev, ...userEmailsOnNode])));
                            }
                          }}
                          className="text-[8px] font-black uppercase text-indigo-500 hover:text-indigo-400"
                        >
                          {userEmailsOnNode.every((tag: string) => selectedEmails.includes(tag)) ? "Deselect" : "Select All"}
                        </button>
                        <Plus size={14} className={`text-muted transition-transform ${isExpanded ? 'rotate-45' : ''}`} />
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 animate-fadeIn">
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line/30">
                          {nodeSpecificClients.map((client: any) => {
                            const xrayEmail = `${user.email.toLowerCase()}#${client.inbound.tag}`;
                            const isSelected = selectedEmails.includes(xrayEmail);
                            return (
                              <button
                                key={client.id}
                                type="button"
                                onClick={() => setSelectedEmails(prev => isSelected ? prev.filter(e => e !== xrayEmail) : [...prev, xrayEmail])}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${isSelected ? "border-emerald-500 bg-emerald-500/10" : "border-line/50 bg-card/50"}`}
                              >
                                <div className="min-w-0">
                                  <p className={`text-[9px] font-black uppercase truncate ${isSelected ? "text-emerald-400" : "text-muted"}`}>{client.inbound.tag}</p>
                                  <p className="text-[7px] font-bold opacity-40 uppercase">{client.inbound.protocol}</p>
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

          {/* ... остальная часть формы (Domains, IPs, Ports) остается без изменений --- */}
          {/* (Пропустил для краткости, оставь как было в твоем исходнике) */}

          <div className="pt-4 flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-5 border border-line rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-card transition-all">Cancel</button>
            <button disabled={loading} className="flex-[2] py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {t("routing.updateRule")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}