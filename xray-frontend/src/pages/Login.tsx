import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/client";
import { saveToken } from "../store/auth";
import { Lock, User, ShieldCheck, AlertCircle, Loader2, Sun, Moon } from "lucide-react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const navigate = useNavigate();

  // Логика смены темы
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(username, password);
      saveToken(data.access_token);
      navigate("/dashboard");
    } catch {
      setError("Неверный логин или пароль");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-main relative overflow-hidden transition-colors duration-500">
      {/* Декоративные градиенты (адаптируются под тему) */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] dark:bg-indigo-500/20" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] dark:bg-blue-500/20" />

      {/* Переключатель темы */}
      <div className="absolute top-8 right-8 z-20">
        <button 
          onClick={toggleTheme}
          className="p-3 bg-card border border-line rounded-2xl text-muted hover:text-base transition-all shadow-xl active:scale-90 flex items-center gap-3 group"
        >
          <div className="relative w-5 h-5">
            <Sun className={`absolute inset-0 transition-all duration-500 ${theme === 'dark' ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100 text-amber-500'}`} size={20} />
            <Moon className={`absolute inset-0 transition-all duration-500 ${theme === 'dark' ? 'rotate-0 scale-100 opacity-100 text-indigo-400' : '-rotate-90 scale-0 opacity-0'}`} size={20} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest pr-1">
            {theme === 'dark' ? 'Nightly' : 'Daylight'}
          </span>
        </button>
      </div>

      <div className="w-full max-w-md z-10 px-4">
        {/* Логотип */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/30 mb-6 transform -rotate-3 hover:rotate-0 transition-all duration-500">
            <ShieldCheck className="text-white" size={32} />
          </div>
          <h1 className="text-4xl font-black text-base tracking-tighter uppercase italic">
            Anaconduit<span className="text-indigo-500">.</span>
          </h1>
          <p className="text-muted mt-3 text-[10px] font-black uppercase tracking-[0.3em]">Secure Access Gateway</p>
        </div>

        {/* Форма */}
        <div className="bg-card/50 backdrop-blur-xl border border-line p-8 rounded-[2.5rem] shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-2">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-muted group-focus-within:text-indigo-500 transition-colors">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  required
                  className="block w-full pl-12 pr-6 py-4 bg-main border border-line rounded-2xl text-base placeholder-muted/50 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 transition-all font-bold"
                  placeholder="System Admin"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-2">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-muted group-focus-within:text-indigo-500 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  className="block w-full pl-12 pr-6 py-4 bg-main border border-line rounded-2xl text-base placeholder-muted/50 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/50 transition-all font-bold"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 text-red-500 bg-red-500/5 p-4 rounded-2xl border border-red-500/20 text-[11px] font-bold uppercase tracking-tight animate-shake">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="relative w-full overflow-hidden bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-3xl shadow-xl shadow-indigo-900/20 transition-all active:scale-[0.98] disabled:opacity-70 group tracking-[0.2em] text-[11px]"
            >
              <div className="relative flex items-center justify-center gap-3">
                {loading ? <Loader2 className="animate-spin" size={20} /> : "INITIALIZE SESSION"}
              </div>
            </button>
          </form>
        </div>

        <p className="text-center mt-10 text-muted text-[9px] font-black uppercase tracking-[0.4em] opacity-40">
          Encrypted Node // 256-BIT REALITY
        </p>
      </div>
    </div>
  );
}