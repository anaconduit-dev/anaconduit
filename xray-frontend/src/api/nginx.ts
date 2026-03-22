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

export interface LandingFile {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  last_modified: number;
}

// Обновим старый интерфейс или заменим его
export interface LandingFilesResponse {
  files: LandingFile[]; // если бэкенд возвращает { "files": [...] }
  // или просто LandingFile[], если возвращает прямой массив
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

export const getLandingFiles = async (subpath: string = ""): Promise<LandingFile[]> => {
  // Передаем subpath как query-параметр
  const response = await api.get('/nginx/landing/list_files', {
    params: { subpath }
  });
  return response.data; // Бэкенд возвращает массив напрямую (судя по твоему коду в FastAPI)
};

// Получить контент конкретного файла
export const getFileContent = async (filename: string): Promise<string> => {
  // Используем encodeURIComponent, чтобы слэши в пути не ломали URL
  const encodedPath = encodeURIComponent(filename);
  const response = await api.get(`/nginx/landing/file/${encodedPath}`);
  return response.data.content;
};
// Сохранить контент (создает или обновляет файл)
export const saveFileContent = async (filename: string, content: string): Promise<{ status: string; message: string }> => {
  const response = await api.post('/nginx/landing/save', { 
    filename, 
    html: content 
  });
  return response.data;
};

// Удалить файл
export const deleteLandingFile = async (filename: string): Promise<void> => {
  const encodedPath = encodeURIComponent(filename);
  await api.delete(`/nginx/landing/file/${encodedPath}`);
};