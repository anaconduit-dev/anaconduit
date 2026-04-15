import { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { 
  Users, Plus, Edit3, 
  LayoutTemplate, ShieldCheck, Trash2,
  Search, X, UserPlus, UserMinus, Check
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useConfirm } from "../context/ConfirmContext";
import { 
  getGroups, addGroup, updateGroup, deleteGroup, 
  getGroupUsers, detachUser, bulkAttachUsers,
  type UserGroup 
} from '../api/sub_templates'; 
import { getTemplates, type Template } from '../api/sub_templates';
import { getUsers } from "../api/user";

interface UserShort {
  id: number;
  email: string;
}

export default function UserGroups() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  
  // Данные (инициализируем пустыми массивами, чтобы не было крашей)
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [allUsers, setAllUsers] = useState<UserShort[]>([]);
  
  // Состояние модалок
  const [activeModal, setActiveModal] = useState<'group' | 'members' | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  // Текущие сущности
  const [editingGroup, setEditingGroup] = useState<Partial<UserGroup> | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<UserShort[]>([]);

  const loadData = async () => {
    try {
        const [gData, tData, uData] = await Promise.all([
        getGroups(), 
        getTemplates(),
        getUsers() // Используем ту же функцию, что и на странице Users
        ]);
        
        setGroups(Array.isArray(gData) ? gData : []);
        setTemplates(Array.isArray(tData) ? tData : []);
        
        // Теперь данные придут в правильном формате (массив объектов)
        setAllUsers(Array.isArray(uData) ? uData : []);
        
    } catch (err) {
        console.error("Load data error:", err);
        toast.error(t("common.error"));
    }
  };

  useEffect(() => { loadData(); }, []);

  // --- Управление Участниками ---
  const handleOpenMembers = async (group: UserGroup) => {
    setSelectedGroup(group);
    setActiveModal('members');
    setGroupMembers([]); // Очищаем перед загрузкой
    try {
      const members = await getGroupUsers(group.id);
      setGroupMembers(Array.isArray(members) ? members : []);
    } catch (err) {
      console.error("Get members error:", err);
      toast.error(t("common.error"));
    }
  };

  const handleToggleUser = async (user: UserShort) => {
    if (!selectedGroup) return;
    const isMember = groupMembers.some(m => m.id === user.id);
    
    try {
      if (isMember) {
        await detachUser(user.id, selectedGroup.id);
        setGroupMembers(prev => prev.filter(m => m.id !== user.id));
        toast.success(t("groups.userRemoved"));
      } else {
        await bulkAttachUsers(selectedGroup.id, [user.id]);
        setGroupMembers(prev => [...prev, user]);
        toast.success(t("groups.userAdded"));
      }
    } catch {
      toast.error(t("common.error"));
    }
  };

  const handleDeleteGroup = async (group: UserGroup) => {
    const isConfirmed = await confirm({ 
        title: t("common.delete"), 
        message: `${t("common.areYouSure")} "${group.name}"?`, 
        type: 'danger' 
    });
    
    if (isConfirmed) {
        try {
          await deleteGroup(group.id);
          toast.success(t("common.deleted"));
          loadData();
        } catch {
          toast.error(t("common.error"));
        }
    }
  };

  // Защищенные фильтры
  const filteredGroups = (groups || []).filter(g => 
    g.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAllUsers = (allUsers || []).filter(u => 
    u.email?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div className="p-8 h-full flex flex-col gap-8 animate-in fade-in duration-500 overflow-y-auto custom-scrollbar">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
              <Users size={24} />
            </div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white">
              {t("groups.title")}<span className="text-indigo-500">.</span>
            </h1>
          </div>
        </div>
        <button 
          onClick={() => { setEditingGroup({name: "", template_id: null}); setActiveModal('group'); }} 
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-indigo-900/20"
        >
          <Plus size={16} strokeWidth={3} /> {t("groups.add")}
        </button>
      </header>

      {/* Поиск */}
      <div className="relative group max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input 
          className="w-full bg-main border border-line rounded-2xl py-3.5 pl-12 pr-4 text-xs font-bold outline-none focus:border-indigo-500/50 transition-all text-white" 
          placeholder={t("common.search")} 
          value={searchQuery} 
          onChange={e => setSearchQuery(e.target.value)} 
        />
      </div>

      {/* Сетка групп */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredGroups.map(group => (
          <div key={group.id} className="group relative bg-main border border-line rounded-[2.5rem] p-8 hover:border-indigo-500/30 transition-all shadow-sm">
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="p-4 bg-indigo-500/10 rounded-[1.5rem] text-indigo-500 border border-indigo-500/10">
                <ShieldCheck size={28} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleOpenMembers(group)} className="p-2.5 bg-card/50 hover:bg-indigo-500/10 rounded-xl text-muted hover:text-indigo-500 border border-line">
                  <UserPlus size={16}/>
                </button>
                <button onClick={() => { setEditingGroup(group); setActiveModal('group'); }} className="p-2.5 bg-card/50 hover:bg-indigo-500/10 rounded-xl text-muted hover:text-indigo-500 border border-line">
                  <Edit3 size={16}/>
                </button>
                <button onClick={() => handleDeleteGroup(group)} className="p-2.5 bg-card/50 hover:bg-red-500/10 rounded-xl text-muted hover:text-red-500 border border-line">
                  <Trash2 size={16}/>
                </button>
              </div>
            </div>

            <div className="space-y-4 relative z-10">
              <div>
                <h3 className="text-xl font-black tracking-tight mb-1 text-white">{group.name}</h3>
                <p className="text-[10px] text-muted font-bold uppercase tracking-widest">ID: {group.id}</p>
              </div>
              <div className="bg-card/50 border border-line rounded-xl px-4 py-3 text-[11px] font-mono text-indigo-400 flex items-center justify-between">
                {templates?.find(t => t.id === group.template_id)?.name || t("groups.noTemplate")}
                <LayoutTemplate size={14} className="opacity-20" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: УПРАВЛЕНИЕ УЧАСТНИКАМИ */}
      {activeModal === 'members' && selectedGroup && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-main border border-line w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-8 border-b border-line flex justify-between items-center">
              <h2 className="text-lg font-black uppercase italic tracking-tighter text-white">{selectedGroup.name}: {t("groups.members")}</h2>
              <button onClick={() => setActiveModal(null)}><X size={24} className="text-muted hover:text-white"/></button>
            </div>
            <div className="p-6 border-b border-line bg-card/10">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                    <input className="w-full bg-main border border-line rounded-xl py-3 pl-12 pr-4 text-xs font-bold outline-none text-white" placeholder={t("groups.searchUsers")} value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
                </div>
            </div>
            {/* Контейнер списка с адаптивной сеткой */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredAllUsers.map(user => {
                    const isMember = groupMembers.some(m => m.id === user.id);
                    return (
                      <div 
                        key={user.id} 
                        className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 ${
                          isMember 
                          ? 'bg-indigo-500/10 border-indigo-500/40 shadow-sm shadow-indigo-500/5' 
                          : 'bg-card/20 border-line hover:border-indigo-500/30'
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span 
                            className={`text-[11px] font-black truncate ${isMember ? 'text-white' : 'text-muted'}`}
                            title={user.email}
                          >
                            {user.email.split('@')[0]}
                          </span>
                          <span className="text-[9px] text-muted/50 truncate">
                            @{user.email.split('@')[1]}
                          </span>
                        </div>

                        <button 
                          onClick={() => handleToggleUser(user)} 
                          className={`p-2.5 rounded-xl transition-all shrink-0 ${
                            isMember 
                            ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-900/20'
                          }`}
                        >
                          {isMember ? <UserMinus size={14} /> : <Check size={14} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
          </div>
        </div>
      )}

      {/* MODAL: ГРУППА */}
      {activeModal === 'group' && editingGroup && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
           <div className="bg-main border border-line w-full max-w-lg rounded-[2.5rem] p-10 space-y-8 shadow-2xl">
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">{editingGroup.id ? t("groups.edit") : t("groups.add")}</h2>
              <div className="space-y-4">
                <input className="w-full bg-card/50 border border-line rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500" placeholder={t("groups.groupName")} value={editingGroup.name} onChange={e => setEditingGroup({...editingGroup, name: e.target.value})} />
                <select className="w-full bg-card/50 border border-line rounded-2xl px-6 py-4 text-sm font-bold text-indigo-400 outline-none" value={editingGroup.template_id || ""} onChange={e => setEditingGroup({...editingGroup, template_id: Number(e.target.value) || null})}>
                  <option value="">-- {t("groups.noTemplate")} --</option>
                  {templates.map(tpl => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
                </select>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setActiveModal(null)} className="flex-1 py-4 text-[10px] font-black uppercase border border-line rounded-2xl text-muted">{t("common.cancel")}</button>
                <button onClick={async () => {
                   try {
                     editingGroup.id ? await updateGroup(editingGroup.id, editingGroup) : await addGroup(editingGroup as any);
                     toast.success(t("common.saved"));
                     setActiveModal(null);
                     loadData();
                   } catch { toast.error(t("common.error")); }
                }} className="flex-1 bg-indigo-600 text-white py-4 text-[10px] font-black uppercase rounded-2xl shadow-lg">{t("common.save")}</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}