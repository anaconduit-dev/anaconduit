import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "react-i18next";
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-json';
import { 
  Save, Plus, Trash2, Layers, 
  Info, Hash, FileJson, Activity, Search,
  ChevronRight, AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useConfirm } from "../context/ConfirmContext";
import { getTemplates, addTemplate, updateTemplate, deleteTemplate, type Template } from '../api/sub_templates';

const DEFAULT_CONFIGS = {
  clash: {
    content: 'mode: rule\nallow-lan: true\nlog-level: info\nunified-delay: true\nproxies: []\nproxy-groups:\n  - name: 🌍 VPN\n    type: select\n    proxies:\n      - \"{{USER_NODES}}\"\nrules:\n  - MATCH,🌍 VPN',
    injection_tag: '{{USER_NODES}}',
    description: 'Standard Clash/Mihomo Template'
  }
};

export default function SubscriptionTemplates() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await getTemplates();
      setTemplates(data);
      if (selected) {
        const updated = data.find(t => t.id === selected.id);
        if (updated) setSelected(updated);
      }
    } catch (e) {
      toast.error(t("templates.errorLoad"));
    } finally {
    }
  }, [selected, t]);

  useEffect(() => { loadTemplates(); }, []);

  const handleSave = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      const cleanContent = selected.content.replace(/\t/g, "  ");
      await updateTemplate(selected.id, { ...selected, content: cleanContent });
      toast.success(t("common.updated"));
      loadTemplates();
    } catch (e) {
      toast.error(t("common.error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = async () => {
    // Определяем тип по умолчанию (пусть будет clash)
    const defaultType = 'clash';
    const config = DEFAULT_CONFIGS[defaultType as keyof typeof DEFAULT_CONFIGS];
    
    // Генерируем простое имя на основе количества существующих шаблонов
    const newName = `${t("templates.newTemplate")} #${templates.length + 1}`;
    
    try {
      const newTpl = await addTemplate({
        name: newName,
        client_type: defaultType,
        content: config.content,
        injection_tag: config.injection_tag,
        description: config.description
      });
      
      toast.success(t("common.saved"));
      await loadTemplates();
      setSelected(newTpl); // Сразу открываем его для редактирования
    } catch (e) {
      toast.error(t("common.error"));
    }
  };

  const handleDelete = async (tpl: Template) => {
    const isConfirmed = await confirm({
      title: t("common.delete"),
      message: `${t("common.areYouSure")} ${tpl.name}?`,
      type: 'danger'
    });

    if (isConfirmed) {
      try {
        await deleteTemplate(tpl.id);
        toast.success(t("common.deleted"));
        if (selected?.id === tpl.id) setSelected(null);
        loadTemplates();
      } catch (e) {
        toast.error(t("common.error"));
      }
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 h-full flex flex-col gap-8 animate-in fade-in duration-500 overflow-hidden">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-900/20">
              <Layers size={22} />
            </div>
            <h1 className="text-3xl font-black text-base tracking-tighter uppercase italic">
              {t("templates.title")}<span className="text-indigo-500">.</span>
            </h1>
          </div>
          <p className="text-muted text-[10px] font-black uppercase tracking-[0.2em] ml-1">
            {t("templates.subtitle") || "Manage your subscription configs"}
          </p>
        </div>

        <button 
          onClick={handleCreateNew}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center gap-2 shadow-xl shadow-indigo-900/20"
        >
          <Plus size={16} strokeWidth={3} /> {t("templates.add")}
        </button>
      </header>

      <div className="flex-1 flex gap-8 min-h-0 overflow-hidden">
        
        {/* Sidebar: Список шаблонов */}
        <div className="w-80 flex flex-col gap-4 shrink-0">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-indigo-500 transition-colors" size={16} />
            <input 
              className="w-full bg-card/40 border border-line rounded-2xl py-3 pl-12 pr-4 text-xs font-bold outline-none focus:border-indigo-500/50 transition-all"
              placeholder={t("common.search")}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
            {filteredTemplates.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => setSelected(tpl)}
                className={`w-full group flex items-center justify-between p-5 rounded-[2rem] border transition-all text-left relative overflow-hidden ${
                  selected?.id === tpl.id 
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                  : 'bg-main border-line text-muted hover:border-indigo-500/50'
                }`}
              >
                <div className="flex flex-col gap-1 relative z-10">
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-50">{tpl.client_type}</span>
                  <span className="text-sm font-bold tracking-tight">{tpl.name}</span>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all relative z-10">
                  <Trash2 
                    size={16} 
                    className="text-muted hover:text-red-500 transition-colors" 
                    onClick={(e) => { e.stopPropagation(); handleDelete(tpl); }}
                  />
                  <ChevronRight size={16} />
                </div>
                {selected?.id === tpl.id && <div className="absolute inset-y-0 left-0 w-1 bg-indigo-500" />}
              </button>
            ))}
          </div>
        </div>

        {/* Main: Редактор кода */}
        <div className="flex-1 bg-main border border-line rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl relative">
          {selected ? (
            <>
              {/* Toolbar */}
                <div className="px-8 py-5 border-b border-line bg-card/30 flex justify-between items-center backdrop-blur-md">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                    <FileJson size={18} className="text-indigo-500" />
                    {/* Выбор типа клиента */}
                    <select 
                        value={selected.client_type}
                        onChange={e => {
                            const newType = e.target.value as keyof typeof DEFAULT_CONFIGS;
                            const updates: Partial<Template> = { client_type: newType };
                            
                            // Если пользователь еще ничего не написал своего (или там дефолт от другого типа)
                            // можно автоматически подставить базу для нового типа
                            if (selected.content.length < 100) { 
                                updates.content = DEFAULT_CONFIGS[newType].content;
                                updates.injection_tag = DEFAULT_CONFIGS[newType].injection_tag;
                            }
                            
                            setSelected({...selected, ...updates});
                        }}
                        className="bg-card/50 border border-line rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-400 outline-none focus:border-indigo-500/50 transition-all cursor-pointer appearance-none hover:bg-card"
                    >
                        <option value="clash">CLASH (YAML)</option>
                        {/* Сюда легко добавлять новые типы в будущем */}
                    </select>
                    </div>
                    
                    <div className="h-4 w-px bg-line" />
                    
                    <input 
                    className="bg-transparent border-none font-mono text-xs text-white/80 outline-none w-64 focus:text-white transition-colors"
                    value={selected.name}
                    onChange={e => setSelected({...selected, name: e.target.value})}
                    placeholder="Template Name"
                    />
                </div>
                
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 transition-all shadow-lg active:scale-95 ${
                    isSaving 
                    ? 'bg-card text-muted' 
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
                    }`}
                >
                    {isSaving ? <Activity className="animate-spin" size={14} /> : <Save size={14} />}
                    {isSaving ? t("common.saving") : t("common.save")}
                </button>
                </div>

              {/* Extra Inputs */}
                <div className="px-8 py-4 bg-card/10 border-b border-line grid grid-cols-3 gap-6">
                  {/* НОВОЕ ПОЛЕ: Название */}
                  <div className="space-y-2">
                      <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                        <Layers size={12} className="text-indigo-500" /> {t("templates.templateName") || "Template Name"}
                      </label>
                      <input 
                        className="w-full bg-main/50 border border-line rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-indigo-500/40 transition-all"
                        value={selected.name}
                        onChange={e => setSelected({...selected, name: e.target.value})}
                      />
                  </div>

                  <div className="space-y-2">
                      <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                        <Hash size={12} className="text-indigo-500" /> Injection Tag
                      </label>
                      <input 
                        className="w-full bg-main/50 border border-line rounded-xl px-4 py-2 text-xs font-mono text-indigo-400 outline-none focus:border-indigo-500/40 transition-all"
                        value={selected.injection_tag}
                        onChange={e => setSelected({...selected, injection_tag: e.target.value})}
                      />
                  </div>

                  <div className="space-y-2">
                      <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                        <Info size={12} className="text-indigo-500" /> {t("templates.description")}
                      </label>
                      <input 
                        className="w-full bg-main/50 border border-line rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-indigo-500/40 transition-all"
                        value={selected.description}
                        onChange={e => setSelected({...selected, description: e.target.value})}
                      />
                  </div>
                </div>

              {/* Editor Surface */}
              <div className="flex-1 overflow-auto font-mono selection:bg-indigo-500/30 custom-scrollbar bg-[#0d0d0f]">
                <Editor
                  value={selected.content}
                  onValueChange={code => setSelected({...selected, content: code})}
                  highlight={code => Prism.highlight(
                    code, 
                    selected.client_type === 'clash' ? Prism.languages.yaml : Prism.languages.json, 
                    selected.client_type === 'clash' ? 'yaml' : 'json'
                  )}
                  padding={32}
                  style={{ 
                    fontSize: 13, 
                    minHeight: '100%',
                    lineHeight: '1.6',
                    fontFamily: '"Fira Code", "JetBrains Mono", monospace'
                  }}
                  className="text-slate-300 focus:outline-none"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 opacity-20">
              <Layers size={80} strokeWidth={1} />
              <div className="text-center space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.4em]">{t("templates.selectPrompt")}</p>
                <div className="flex items-center gap-2 text-xs justify-center">
                  <AlertCircle size={14} />
                  <span>Select a template from the left sidebar to edit</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}