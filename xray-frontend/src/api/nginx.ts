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
export const applyNginx = () => api.post('/nginx/apply');

export const getNginxLogs = async (tail: number = 100) => {
  const res = await api.get(`/nginx/logs?tail=${tail}`);
  return res.data; // Ожидаем массив строк или одну большую строку
};