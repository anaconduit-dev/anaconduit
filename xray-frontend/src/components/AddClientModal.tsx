import React, { useState, useEffect } from "react";
import { X, Server, Zap, Loader2 } from "lucide-react";
import { addClient } from "../api/user"; 
import { getInbounds } from "../api/inbound"; 

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingUser?: any;
}

export default function AddClientModal({ isOpen, onClose, onSuccess, existingUser = null }: AddClientModalProps) {
  const [inbounds, setInbounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    inboundId: "",
    email: "",
    uuid: "",
    flow: "",
    level: 0
  });

  const generateSecret = (protocol: string) => {
    if (protocol === 'trojan' || protocol === 'shadowsocks') {
      return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    }
    return crypto.randomUUID();
  };

  const isAlreadyAdded = (inboundId: number) => {
    if (!existingUser || !existingUser.clients) return false;
    return existingUser.clients.some((c: any) => c.inbound_id === inboundId);
  };

  useEffect(() => {
    if (isOpen) {
      getInbounds().then((data) => setInbounds(Array.isArray(data) ? data : []));
      setForm({
        inboundId: "",
        email: existingUser?.email || "",
        uuid: crypto.randomUUID(),
        flow: "",
        level: 0
      });
    }
  }, [isOpen, existingUser]);

  const handleInboundChange = (id: string) => {
    const selected = inbounds.find((i: any) => i.id === Number(id));
    if (!selected) return;

    setForm({
      ...form, 
      inboundId: id, 
      uuid: generateSecret(selected.protocol),
      flow: ''
    });
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = Number(form.inboundId);
    if (!targetId) return;

    if (isAlreadyAdded(targetId)) {
      alert(`Пользователь ${form.email} уже добавлен к этому инбаунду!`);
      return;
    }

    setLoading(true);
    try {
      await addClient(targetId, form.email, form.uuid, form.flow, form.level);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Ошибка сервера");
    } finally {
      setLoading(false);
    }
  };

  const selectedProtocol = inbounds.find(i => i.id === Number(form.inboundId))?.protocol;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 transition-all">
      <div className="bg-card w-full max-w-lg rounded-[3rem] shadow-2xl border border-line overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-8 bg-main/50 border-b border-line flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg">
              <Server size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-base">
                {existingUser ? "Привязать инбаунд" : "Новый пользователь"}
              </h2>
              <p className="text-[10px] font-bold text-indigo-500 uppercase">
                {existingUser ? `Для ${existingUser.email}` : "Создание аккаунта"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-main p-2 rounded-full transition-colors text-muted hover:text-base">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          {/* Select Inbound */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase ml-1">Целевой сервер</label>
            <select 
              required
              className="w-full p-4 bg-main border border-line rounded-2xl font-bold text-sm text-base outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={form.inboundId}
              onChange={e => handleInboundChange(e.target.value)}
            >
              <option value="">Выберите инбаунд...</option>
              {inbounds.map((ib: any) => {
                const disabled = isAlreadyAdded(ib.id);
                return (
                  <option key={ib.id} value={ib.id} disabled={disabled} className="bg-card text-base">
                    {disabled ? `🔒 [УЖЕ ЕСТЬ] ${ib.tag}` : `[${ib.protocol.toUpperCase()}] ${ib.tag}`}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase ml-1">Email</label>
            <input 
              required
              disabled={!!existingUser}
              className={`w-full p-4 border rounded-2xl font-bold text-sm outline-none transition-all ${
                existingUser 
                ? 'bg-main text-muted border-line' 
                : 'bg-card border-line text-base focus:border-indigo-500'
              }`}
              value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
              placeholder="username"
            />
          </div>

          {/* Secret (UUID/Password) */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase ml-1">
              {selectedProtocol === 'trojan' ? 'Пароль' : 'UUID / ID'}
            </label>
            <input 
              required
              className="w-full p-4 border border-line bg-card rounded-2xl font-mono text-xs text-base outline-none focus:border-indigo-500 transition-all"
              value={form.uuid}
              onChange={e => setForm({...form, uuid: e.target.value})}
            />
          </div>

          {/* Grid: Flow & Level */}
          <div className="grid grid-cols-2 gap-4">
            {selectedProtocol === 'vless' ? (
              <div className="space-y-2 animate-in slide-in-from-left-2">
                <label className="text-[10px] font-black text-muted uppercase ml-1">Flow</label>
                <select 
                  className="w-full p-4 bg-card border border-line rounded-2xl font-bold text-sm text-base outline-none focus:border-indigo-500 transition-all"
                  value={form.flow}
                  onChange={e => setForm({...form, flow: e.target.value})}
                >
                  <option value="">None</option>
                  <option value="xtls-rprx-vision">Vision</option>
                </select>
              </div>
            ) : (
              <div className="space-y-2 opacity-50">
                <label className="text-[10px] font-black text-muted uppercase ml-1">Flow</label>
                <div className="w-full p-4 bg-main border border-line rounded-2xl font-bold text-xs text-muted">
                  Недоступно
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted uppercase ml-1">Level</label>
              <input 
                type="number"
                className="w-full p-4 bg-card border border-line rounded-2xl font-bold text-sm text-base outline-none focus:border-indigo-500 transition-all"
                value={form.level}
                onChange={e => setForm({...form, level: Number(e.target.value)})}
              />
            </div>
          </div>

          {/* Action Button */}
          <button 
            disabled={loading || !form.inboundId}
            type="submit"
            className="w-full p-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase text-xs shadow-xl dark:shadow-indigo-950/20 shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 active:scale-95"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
            {existingUser ? "Привязать к серверу" : "Создать и подключить"}
          </button>
        </form>
      </div>
    </div>
  );
}