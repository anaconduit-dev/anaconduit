import { api } from "./client";

export interface ConfigLink {
  tag: string;
  protocol: string;
  link: string;
}

export interface UserConfigResponse {
  user_email: string;
  links: ConfigLink[];
  subscription: string; // Base64 строка со всеми ссылками
  link_subscription: string;
}

/** * Получить список всех ссылок (конфигов) пользователя и строку подписки 
 * @param userId - ID пользователя в системе
 * @param token
 */
export const getUserConfigLinks = async (userId: number) => {
  const res = await api.get(`/subscribe/${userId}/config-links`);
  return res.data;
};


export const getSubscriptionInfo = async (token: string) => {
  try {
    // Используем axios напрямую или чистый fetch, чтобы не подмешивать заголовки авторизации админа
    // Путь теперь выглядит так: /secret_path/TOKEN/info
    const response = await api.get(`/api/v1/${token}/info`); 
    return response.data;
  } catch (error) {
    console.error("Failed to fetch subscription:", error);
    throw error;
  }
};