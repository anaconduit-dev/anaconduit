import { useState, useEffect, useRef } from "react";
import { Terminal, RefreshCcw, } from "lucide-react";

interface LogTerminalProps {
  title: string;
  fetchFn: (tail: number) => Promise<any>;
  autoRefreshMs?: number;
  height?: string;
}

export default function LogTerminal({ 
  title, 
  fetchFn, 
  autoRefreshMs = 10000, 
  height = "h-[400px]" 
}: LogTerminalProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchFn(100);
      // Обрабатываем и объект {logs: "..."}, и прямую строку
      const rawLogs = typeof data === 'string' ? data : (data.logs || ""); 
      const logArray = rawLogs.split('\n').filter((l: string) => l.trim() !== "");
      setLogs(logArray);
    } catch (e) {
      setLogs(["[Error] Не удалось получить логи"]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    if (autoRefreshMs > 0) {
      const timer = setInterval(fetchLogs, autoRefreshMs);
      return () => clearInterval(timer);
    }
  }, [fetchFn]);

  // Скролл вниз при обновлении
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const formatLogLine = (line: string) => {
    const l = line.toLowerCase();
    if (l.includes("error") || l.includes("failed") || l.includes(" 404 ") || l.includes(" 500 ")) 
      return "text-red-400 font-bold";
    if (l.includes("warn")) return "text-amber-400";
    if (l.includes("info") || l.includes("getting") || l.includes(" 200 ")) return "text-emerald-400";
    if (l.includes("accepted") || l.includes("proxy") || l.includes("config")) return "text-indigo-400";
    return "text-slate-300";
  };

  return (
    <div className={`bg-slate-950 rounded-[32px] border border-slate-800 shadow-2xl overflow-hidden flex flex-col ${height}`}>
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3 text-slate-400">
          <Terminal size={18} className="text-indigo-500" />
          <span className="text-xs font-black uppercase tracking-widest">{title}</span>
        </div>
        <div className="flex items-center gap-2">
           <button 
            onClick={fetchLogs}
            className="p-2 hover:bg-white/10 rounded-xl text-slate-500 transition-colors"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 font-mono text-[11px] leading-relaxed selection:bg-indigo-500/30"
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 italic">Ожидание данных...</div>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="flex gap-4 group hover:bg-white/5 py-0.5 px-2 -mx-2 rounded">
              <span className="text-slate-800 select-none w-8 text-right italic shrink-0">{i + 1}</span>
              <span className={`${formatLogLine(line)} break-all`}>{line}</span>
            </div>
          ))
        )}
      </div>
      
      <div className="px-6 py-2 bg-slate-900/30 border-t border-slate-800 flex justify-between items-center text-[9px] font-bold uppercase tracking-tighter">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-500 text-[10px]">Live Stream</span>
        </div>
        <span className="text-slate-600">Buffer: 100 lines</span>
      </div>
    </div>
  );
}