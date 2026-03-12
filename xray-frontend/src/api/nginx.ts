import { api } from "./client";

export interface NginxStatus {
  container: string;
  status: string;
  version: string;
}

export interface LandingFileContent {
  content: string;
}

export interface LandingFilesList {
  files: string[];
}

// Интерфейс для нашей заглушки
export interface LandingData {
  html: string;
}

/**
 * Управление статусом Nginx
 */
export const getNginxStatus = async (): Promise<NginxStatus> => {
  const response = await api.get('/nginx/status');
  return response.data;
};

export const startNginx = () => api.post('/nginx/start');
export const stopNginx = () => api.post('/nginx/stop');
export const restartNginx = () => api.post('/nginx/restart');
export const applyNginx = () => api.post('/nginx/apply');

export const getNginxLogs = async (tail: number = 100): Promise<string[]> => {
  const res = await api.get(`/nginx/logs?tail=${tail}`);
  return res.data; 
};

/**
 * Управление Landing Page (index.html)
 */

// Получить текущий HTML код заглушки
export const getLandingContent = async (): Promise<LandingData> => {
  const response = await api.get('/nginx/landing');
  return response.data;
};

// Сохранить новый HTML код
export const updateLandingContent = async (html: string): Promise<{ status: string; message: string }> => {
  const response = await api.post('/nginx/landing', { html });
  return response.data;
};

export const getLandingFiles = async (): Promise<string[]> => {
  const response = await api.get('/nginx/landing/files');
  return response.data.files;
};

// Получить контент конкретного файла
export const getFileContent = async (filename: string): Promise<string> => {
  const response = await api.get(`/nginx/landing/file/${filename}`);
  return response.data.content;
};

// Сохранить контент (создает или обновляет файл)
export const saveFileContent = async (filename: string, content: string): Promise<void> => {
  await api.post('/nginx/landing/save', { filename, html: content });
};

// Удалить файл
export const deleteLandingFile = async (filename: string): Promise<void> => {
  await api.delete(`/nginx/landing/file/${filename}`);
};