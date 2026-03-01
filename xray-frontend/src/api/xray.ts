import { api } from "./client";

// Опишем интерфейс ответа для TypeScript (если используешь его)
export interface XrayStatus {
  container: string;
  status: string;
  version: string;
}

export const getXrayStatus = async (): Promise<XrayStatus> => {
  const response = await api.get('/xray/status');
  return response.data;
};

// Тут же можно будет добавить управление
export const startXray = async () => {
  const response = await api.post('/xray/start');
  return response.data;
};

export const stopXray = async () => {
  const response = await api.post('/xray/stop');
  return response.data;
};

export const restartXray = async () => {
  const response = await api.post('/xray/restart');
  return response.data;
};

// Получить список версий с GitHub
export const getXrayVersions = async (): Promise<string[]> => {
  const response = await api.get('/xray/versions');
  return response.data;
};

// Установить конкретную версию
export const installXrayVersion = async (version: string) => {
  const response = await api.post(`/xray/install/${version}`);
  return response.data;
};