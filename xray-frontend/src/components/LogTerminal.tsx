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
    <div className={`bg-main rounded-[2.5rem] border border-line shadow-2xl overflow-hidden flex flex-col transition-all ${height}`}>
      {/* Заголовок терминала */}
      <div className="px-6 py-4 border-b border-line bg-card/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <Terminal size={16} className="text-indigo-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-base uppercase tracking-[0.2em] leading-none">{title}</span>
            <span className="text-[8px] text-muted font-bold uppercase mt-1 tracking-tighter">System Output</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchLogs}
            className="p-2.5 hover:bg-indigo-500/10 rounded-xl text-muted hover:text-indigo-500 transition-all active:scale-90"
            title="Обновить логи"
          >
            <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Тело терминала */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 font-mono text-[11px] leading-relaxed selection:bg-indigo-500/30 bg-[#0c0c0e] custom-scrollbar"
      >
        {logs.length === 0 ? (
          <div className="flex items-center gap-3 text-muted/40 italic">
            <div className="w-1 h-1 rounded-full bg-muted/40 animate-bounce" />
            <span>Ожидание системных данных...</span>
          </div>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="flex gap-4 group hover:bg-white/[0.03] py-0.5 px-3 -mx-3 rounded-md transition-colors">
              <span className="text-muted/20 select-none w-8 text-right font-bold shrink-0 group-hover:text-muted/40 transition-colors">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className={`${formatLogLine(line)} break-all tracking-tight`}>
                {line}
              </span>
            </div>
          )) // <-- Проверь, что эта скобка и следующая на месте
        )}
      </div>
      
      {/* Футер терминала */}
      <div className="px-6 py-3 bg-card/50 border-t border-line flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <div className="absolute w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-40" />
          </div>
          <span className="text-muted text-[9px] font-black uppercase tracking-widest">Live Stream Active</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="h-3 w-px bg-line" />
          <span className="text-muted/60 text-[9px] font-bold uppercase">
            Buffer: <span className="text-base">100 lines</span>
          </span>
        </div>
      </div>
    </div>
  );
}