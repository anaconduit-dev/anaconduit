import { useEffect, useState } from "react";
import { getSubscriptionInfo } from "../api/subscribe";
import { useParams, useSearchParams } from "react-router-dom";

export default function SubscriptionPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Достаем токен из пути /jsdfdjjsdh/TOKEN
  const { token: urlToken } = useParams(); 
  // Достаем токен из query /jsdfdjjsdh?token=TOKEN
  const [searchParams] = useSearchParams();
  const queryToken = searchParams.get("token");

  // Определяем финальный токен
  const activeToken = urlToken || queryToken || null;

  useEffect(() => {
    if (activeToken) {
      setLoading(true);
      getSubscriptionInfo(activeToken)
        .then((res) => {
          setData(res);
          setError(null);
        })
        .catch((_err) => {
          setError("Не удалось загрузить данные подписки. Возможно, токен недействителен.");
        })
        .finally(() => setLoading(false));
    }
  }, [activeToken]);

  const copyToClipboard = async (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
    }
  };

  if (!activeToken) return <div className="text-white p-10 text-center">Токен не указан</div>;
  
  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400 p-10 text-center">
      <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl">
        {error}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-200">
      <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h1 className="text-2xl font-bold mb-2">Привет, {data?.username || "Пользователь"}</h1>
        
        <div className={`mb-6 py-2 px-4 border rounded-lg text-sm ${
          data?.status === 'active' 
          ? 'bg-green-500/10 border-green-500/20 text-green-400' 
          : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          Статус подписки: {data?.status === 'active' ? 'Активна' : 'Отключена'}
        </div>

        <div className="space-y-2 mb-8">
          <div className="flex justify-between text-sm">
            <span>Использовано трафика</span>
            <span>{data?.usage_percent}%</span>
          </div>
          <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
            <div 
              className="bg-blue-500 h-full transition-all duration-700 ease-out" 
              style={{ width: `${data?.usage_percent || 0}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>{data?.used_traffic_gb} ГБ</span>
            <span>из {data?.total_traffic_gb || "∞"} ГБ</span>
          </div>
        </div>

        <div className="space-y-3">
          <button 
            onClick={async () => {
                if (data?.links?.subscription_url) {
                  await copyToClipboard(data.links.subscription_url);
                  alert("Ссылка скопирована!");
                }
            }}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-all active:scale-95"
          >
            Копировать подписку
          </button>
          
          <p className="text-[10px] text-slate-500 text-center px-4">
            Вставьте эту ссылку в ваше приложение (v2rayNG, Shadowrocket, Nekobox)
          </p>
        </div>
      </div>
    </div>
  );
}