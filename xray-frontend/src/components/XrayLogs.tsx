import { useState, useEffect, useRef } from "react";
import { Terminal, RefreshCcw } from "lucide-react";
import { getXrayLogs } from "../api/xray";

export function XrayLogs() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
  setLoading(true);
  try {
    const data = await getXrayLogs(100);
    
    // Извлекаем строку из поля logs
    const rawLogs = data.logs || ""; 
    
    // Разбиваем строку на массив, убираем пустые элементы
    const logArray = rawLogs.split('\n').filter((l: string) => l.trim() !== "");
    
    setLogs(logArray);
  } catch (e) {
    setLogs(["[Error] Не удалось получить логи из контейнера"]);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchLogs();
    const timer = setInterval(fetchLogs, 10000); // Автообновление каждые 10 сек
    return () => clearInterval(timer);
  }, []);

  // Функция для раскраски строк
  const formatLogLine = (line: string) => {
    if (line.includes("error") || line.includes("ERROR") || line.includes("failed")) 
      return "text-red-400 font-bold";
    if (line.includes("warning") || line.includes("WARNING")) 
      return "text-amber-400";
    if (line.includes("info") || line.includes("INFO")) 
      return "text-emerald-400";
    if (line.includes("accepted") || line.includes("proxy"))
      return "text-indigo-400";
    return "text-slate-300";
  };

  return (
    <div className="bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden mt-8 flex flex-col h-[400px]">
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3 text-slate-400">
          <Terminal size={18} className="text-indigo-500" />
          <span className="text-xs font-black uppercase tracking-widest">Xray Live Logs</span>
        </div>
        <button 
          onClick={fetchLogs}
          className="p-2 hover:bg-slate-800 rounded-xl text-slate-500 transition-colors"
        >
          <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 font-mono text-[11px] leading-relaxed custom-scrollbar selection:bg-indigo-500/30"
      >
        {logs.map((line, i) => (
          <div key={i} className="flex gap-4 group hover:bg-white/5 py-0.5 px-2 -mx-2 rounded">
            <span className="text-slate-700 select-none w-8 text-right italic">{i + 1}</span>
            <span className={formatLogLine(line)}>{line}</span>
          </div>
        ))}
      </div>
      
      <div className="px-6 py-2 bg-slate-900/30 border-t border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Streaming Active</span>
        </div>
        <span className="text-[10px] text-slate-600 font-mono italic">Tail: 100 lines</span>
      </div>
    </div>
  );
}