import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from 'react-hot-toast';
import { useTranslation } from "react-i18next";
import { useConfirm } from "../context/ConfirmContext";
import {  
  Trash2, Cpu,
  Send, 
  Zap, 
  Loader2, 
  Settings2, 
  PlusCircle, 
  ShieldCheck, 
  Anchor,
  Globe, 
  Shield, 
  Hash
} from "lucide-react";
import { 
  getOutbounds, 
  deleteOutbound, 
  getRoutingRules, 
  deleteRoutingRule, 
  updateRoutingRule 
} from "../api/outbound";
import { getNodes, type Node } from "../api/nodes";
import { getGlobalSettings, updateGlobalSettings } from "../api/settings";
import AddOutboundModal from "../components/AddOutboundModal";
import EditOutboundModal from "../components/EditOutboundModal";
import AddRoutingRuleModal from "../components/AddRoutingRuleModal";
import EditRoutingRuleModal from "../components/EditRoutingRuleModal";

export default function OutboundsPage() {
  const confirm = useConfirm();
  const { t } = useTranslation();
  
  // Состояния данных
  const [activeTab, setActiveTab] = useState<'exits' | 'rules'>('exits');
  const [outbounds, setOutbounds] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);

  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [isSavingStrategy, setIsSavingStrategy] = useState(false);
  
  // Состояния модалок
  const [isAddOutboundOpen, setIsAddOutboundOpen] = useState(false);
  const [isEditOutboundOpen, setIsEditOutboundOpen] = useState(false);
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [selectedOutbound, setSelectedOutbound] = useState<any | null>(null);
  const [isEditRuleOpen, setIsEditRuleOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any | null>(null);

  const nodesMap = useMemo(() => {
    return nodes.reduce((acc, node) => {
      acc[node.id] = node.name;
      return acc;
    }, {} as Record<number, string>);
  }, [nodes]);

  // Загрузка всех данных (Promise.all для скорости)
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [outData, rulesData, settingsData, nodesData] = await Promise.all([
        getOutbounds(),
        getRoutingRules(),
        getGlobalSettings(),
        getNodes()
      ]);
      setOutbounds(Array.isArray(outData) ? outData : []);
      setRules(Array.isArray(rulesData) ? rulesData : []);
      setGlobalSettings(settingsData);
      setNodes(Array.isArray(nodesData) ? nodesData : []);
    } catch (e) {
      toast.error(t("common.errorConnection"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadData(); }, [loadData]);

  // --- Handlers для Outbounds (Gateways) ---
  const handleEditOutbound = (outbound: any) => {
    setSelectedOutbound(outbound);
    setIsEditOutboundOpen(true);
  };

  const handleStrategyChange = async (newStrategy: string) => {
    setIsSavingStrategy(true);
    try {
      await updateGlobalSettings({ domain_strategy: newStrategy });
      setGlobalSettings((prev: any) => ({ ...prev, domain_strategy: newStrategy }));
      toast.success(`Domain Strategy: ${newStrategy} applied`);
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Failed to update strategy");
    } finally {
      setIsSavingStrategy(false);
    }
  };

  const handleDeleteOutbound = async (id: number, tag: string) => {
    const ok = await confirm({ 
      title: t("outbounds.deleteOutbound"), 
      message: t("outbounds.deleteConfirm", { tag }), 
      type: 'danger' 
    });
    if (ok) {
      toast.promise(deleteOutbound(id), {
        loading: t("common.deleting"),
        success: () => { loadData(); return t("common.success"); },
        error: (err) => err.response?.data?.detail || "Error"
      });
    }
  };

  // --- Handlers для Routing Rules ---
  const handleToggleRule = async (id: number, currentStatus: boolean) => {
    try {
      await updateRoutingRule(id, { is_active: !currentStatus });
      loadData();
      toast.success(t("routing.statusUpdated"));
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t("common.error"));
    }
  };

  const handleEditRule = (rule: any) => {
    setSelectedRule(rule);
    setIsEditRuleOpen(true);
  };
  const handleDeleteRule = async (id: number) => {
    const ok = await confirm({ 
      title: t("routing.deleteTitle"), 
      message: t("routing.deleteConfirm"), 
      type: 'danger' 
    });
    if (ok) {
      toast.promise(deleteRoutingRule(id), {
        loading: t("common.deleting"),
        success: () => { loadData(); return t("common.success"); },
        error: (err) => err.response?.data?.detail || t("common.error")
      });
    }
  };

  const getProtocolIcon = (protocol: string) => {
    switch (protocol) {
      case 'freedom': return <Zap size={18} />;
      case 'blackhole': return <ShieldCheck size={18} />;
      default: return <Anchor size={18} />;
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto custom-scrollbar bg-main">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER С ТАБАМИ */}
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-900/20">
                <Send size={22} />
              </div>
              <h1 className="text-3xl font-black text-base tracking-tighter uppercase italic">
                {activeTab === 'exits' ? t("outbounds.title") : "Routing"}<span className="text-indigo-500">.</span>
              </h1>
            </div>
            <p className="text-muted text-[10px] font-black uppercase tracking-[0.2em] ml-1">
              {activeTab === 'exits' ? t("outbounds.info") : "Traffic steering logic & filters"}
            </p>
          </div>

          <div className="bg-card/50 p-1.5 rounded-[1.5rem] border border-line flex gap-1 self-start md:self-auto">
            <button 
              onClick={() => setActiveTab('exits')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'exits' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-muted hover:text-base'}`}
            >
              {t("routing.tabs.gateways")}
            </button>
            <button 
              onClick={() => setActiveTab('rules')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'rules' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-muted hover:text-base'}`}
            >
              {t("routing.tabs.rules")}
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="animate-spin text-indigo-500" size={48} />
            <span className="text-[10px] font-black text-muted uppercase tracking-[0.3em]">{t("common.loadingEngine")}</span>
          </div>
        ) : (
          <div className="animate-fadeIn">
            {activeTab === 'exits' ? (
              /* --- СЕКЦИЯ GATEWAYS --- */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <button 
                  onClick={() => setIsAddOutboundOpen(true)}
                  className="bg-card/30 border-2 border-dashed border-line rounded-[2.5rem] flex flex-col items-center justify-center p-8 group hover:border-indigo-500/50 transition-all min-h-[240px]"
                >
                  <PlusCircle size={28} className="mb-4 text-muted group-hover:text-indigo-500" />
                  <span className="text-[10px] font-black uppercase text-muted tracking-[0.2em]">{t("outbounds.addOutbound")}</span>
                </button>

                {outbounds.map((out) => (
                  <div key={out.id} className="bg-card/40 rounded-[2.5rem] border border-line shadow-sm relative group overflow-hidden flex flex-col min-h-[240px]">
                    <div className="p-7 flex-1">
                      <div className="flex justify-between items-start mb-6">
                        <div className={`p-3 rounded-2xl ${out.is_default ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-900/20' : 'bg-main text-muted border border-line'}`}>
                          {getProtocolIcon(out.protocol)}
                        </div>
                        {/* НОВОЕ: Бейдж ноды */}
                        <div className="px-3 py-1.5 bg-main border border-line rounded-xl flex items-center gap-2">
                          <Cpu size={12} className="text-indigo-500" />
                          <span className="text-[9px] font-black uppercase tracking-tighter text-base italic">
                            {nodesMap[out.node_id] || t("nodes.masterNode")}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleEditOutbound(out)}
                            className="p-2.5 bg-main border border-line text-muted hover:text-indigo-500 rounded-xl transition-all"
                          >
                            <Settings2 size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteOutbound(out.id, out.tag)}
                            className="p-2.5 bg-main border border-line text-muted hover:text-red-500 rounded-xl transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-base font-black text-base truncate uppercase tracking-tight italic">
                          {out.tag}
                        </h3>
                        <div className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
                          <div className="w-1 h-1 rounded-full bg-indigo-500" /> {out.protocol}
                        </div>
                      </div>

                      <div className="mt-5 pt-5 border-t border-line/50">
                        <p className="text-[8px] font-black text-muted uppercase tracking-widest mb-1 opacity-50">{t("outbounds.targetDescription")}</p>
                        <p className="text-xs font-mono font-bold text-base truncate opacity-80 italic">
                          {out.settings?.servers?.[0]?.address || out.description || t("outbounds.directSystem")}
                        </p>
                      </div>
                    </div>

                    <div className={`py-3 px-7 text-[9px] font-black uppercase tracking-[0.2em] flex items-center justify-between ${out.is_active ? 'bg-emerald-500/5 text-emerald-500' : 'bg-red-500/5 text-red-500 opacity-60'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${out.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {out.is_active ? t("outbounds.statusActive") : t("outbounds.statusDisabled")}
                      </div>
                      {out.is_default && <span className="text-indigo-500 text-[8px] italic">● {t("outbounds.defaultGateway")}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* --- СЕКЦИЯ ROUTING RULES --- */
              <div className="animate-fadeIn"> 
                {/* Глобальная настройка стратегии */}
                <div className="max-w-5xl mb-8 p-6 bg-card/20 border border-line rounded-[2.2rem] flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-2xl border border-indigo-500/20">
                      <Globe size={20} />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-base tracking-widest leading-tight">
                        {t("routing.strategy.title")}
                      </h4>
                      <p className="text-[9px] text-muted font-bold uppercase tracking-tighter opacity-60">
                        {t("routing.strategy.description")}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 bg-main p-1.5 rounded-2xl border border-line">
                    {['AsIs', 'IPIfNonMatch', 'IPOnDemand'].map((strategy) => (
                      <button
                        key={strategy}
                        disabled={isSavingStrategy}
                        onClick={() => handleStrategyChange(strategy)}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all flex items-center gap-2
                          ${globalSettings?.domain_strategy === strategy 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                            : 'text-muted hover:text-base'}`}
                      >
                        {isSavingStrategy && globalSettings?.domain_strategy === strategy && (
                          <Loader2 size={10} className="animate-spin" />
                        )}
                        {strategy}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-w-5xl space-y-4">
                  <button 
                    onClick={() => setIsAddRuleOpen(true)}
                    className="w-full py-6 border-2 border-dashed border-line rounded-[2.2rem] flex items-center justify-center gap-3 text-muted hover:border-indigo-500/50 hover:text-indigo-500 transition-all mb-6 bg-card/20"
                  >
                    <PlusCircle size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{t("routing.addRule")}</span>
                  </button>

                  {rules.length === 0 ? (
                    <div className="text-center py-20 bg-card/20 rounded-[2.5rem] border border-line">
                      <p className="text-xs font-black text-muted uppercase tracking-widest italic opacity-40">{t("routing.noRules")}</p>
                    </div>
                  ) : (
                    rules.map((rule) => (
                      <div 
                        key={rule.id} 
                        className={`bg-card/40 border border-line rounded-[2.2rem] p-6 flex items-center gap-6 group hover:border-indigo-500/30 transition-all ${!rule.is_active && 'opacity-50 grayscale'}`}
                      >
                        <div className="bg-main rounded-2xl p-4 min-w-[75px] text-center border border-line shadow-inner">
                          <span className="text-[8px] font-black text-muted uppercase block mb-1 opacity-50 tracking-tighter">{t("routing.rule.priority")}</span>
                          <span className="text-xl font-black text-indigo-500 italic leading-none">{rule.priority}</span>
                        </div>

                        <div className="flex-1 space-y-3">
                          {/* Добавим информацию о ноде над списком доменов/IP */}
                          <div className="flex items-center gap-2 mb-1">
                            <Cpu size={10} className="text-muted" />
                            <span className="text-[8px] font-bold text-muted uppercase tracking-[0.1em]">
                              Target Node: <span className="text-indigo-500">{nodesMap[rule.node_id] || t("nodes.masterNode")}</span>
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {rule.domain?.map((d: string) => (
                              <span key={d} className="px-2.5 py-1.5 bg-indigo-500/10 text-indigo-400 text-[9px] font-black rounded-xl border border-indigo-500/20 flex items-center gap-1.5 uppercase tracking-tighter">
                                <Globe size={11} /> {d}
                              </span>
                            ))}
                            {rule.ip?.map((i: string) => (
                              <span key={i} className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-black rounded-xl border border-emerald-500/20 flex items-center gap-1.5 uppercase tracking-tighter">
                                <Shield size={11} /> {i}
                              </span>
                            ))}
                            {rule.port && (
                              <span className="px-2.5 py-1.5 bg-amber-500/10 text-amber-400 text-[9px] font-black rounded-xl border border-amber-500/20 flex items-center gap-1.5 uppercase tracking-tighter">
                                <Hash size={11} /> {rule.port}
                              </span>
                            )}
                            {!rule.domain && !rule.ip && !rule.port && (
                              <span className="text-[9px] font-black text-muted/40 uppercase italic tracking-widest">{t("routing.rule.catchAll")}</span>
                            )}
                          </div>
                          {rule.description && (
                            <p className="text-[10px] text-muted italic font-medium ml-1"># {rule.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-4 pl-6 border-l border-line">
                          <div className="text-right min-w-[100px]">
                            <p className="text-[8px] font-black text-muted uppercase tracking-[0.2em] mb-1 opacity-40">{t("routing.rule.forwarding")}</p>
                            <p className="text-xs font-black text-indigo-500 uppercase italic tracking-tight">{rule.outbound_tag}</p>
                          </div>
                          
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleEditRule(rule)}
                              className="p-3 bg-main border border-line text-muted hover:text-indigo-500 rounded-2xl transition-all"
                            >
                              <Settings2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleToggleRule(rule.id, rule.is_active)}
                              className={`p-3 rounded-2xl transition-all border ${rule.is_active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-main text-muted border-line'}`}
                            >
                              <Zap size={16} fill={rule.is_active ? "currentColor" : "none"} />
                            </button>
                            <button 
                              onClick={() => handleDeleteRule(rule.id)} 
                              className="p-3 bg-main border border-line text-muted hover:text-red-500 rounded-2xl transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODALS */}
      <AddOutboundModal 
        isOpen={isAddOutboundOpen} 
        nodes={nodes}
        onClose={() => setIsAddOutboundOpen(false)} 
        onSuccess={loadData} 
      />
      
      {isEditOutboundOpen && selectedOutbound && (
        <EditOutboundModal 
          isOpen={isEditOutboundOpen} 
          outbound={selectedOutbound}
          key={selectedOutbound.id}
          onClose={() => { 
            setIsEditOutboundOpen(false); 
            setSelectedOutbound(null); 
          }} 
          onSuccess={loadData} 
        />
      )}

      {isEditRuleOpen && selectedRule && (
        <EditRoutingRuleModal 
          isOpen={isEditRuleOpen}
          rule={selectedRule}
          outbounds={outbounds}
          key={selectedRule.id}
          onClose={() => {
            setIsEditRuleOpen(false);
            setSelectedRule(null);
          }}
          onSuccess={loadData}
        />
      )}

      <AddRoutingRuleModal 
        isOpen={isAddRuleOpen} 
        nodes={nodes}
        outbounds={outbounds} 
        onClose={() => setIsAddRuleOpen(false)} 
        onSuccess={loadData} 
      />
    </div>
  );
}