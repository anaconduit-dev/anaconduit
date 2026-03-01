import { api } from "./client";

// Опишем интерфейс ответа для TypeScript (если используешь его)
export interface NginxStatus {
  container: string;
  status: string;
  version: string;
}

export const getNginxStatus = async (): Promise<NginxStatus> => {
  const response = await api.get('/nginx/status');
  return response.data;
};

// Тут же можно будет добавить управление
export const startNginx = async () => {
  const response = await api.post('/nginx/start');
  return response.data;
};


export const stopNginx = () => api.post('/nginx/stop');
export const restartNginx = () => api.post('/nginx/restart'); // или reload
export const setupNginx = (use_ssl: boolean) => api.post(`/nginx/setup?use_ssl=${use_ssl}`);
