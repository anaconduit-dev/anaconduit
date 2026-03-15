import { api } from "./client";

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