import { api } from "./client";

/**
 * Интерфейсы для Бэкапов
 */
export interface BackupFile {
  filename: string;
  size: number;
  created_at: string; // ISO string с бэкенда
}

/**
 * Управление Бэкапами БД
 */

// Получить список всех бэкапов
export const getBackupsList = async (): Promise<BackupFile[]> => {
  const response = await api.get('/backup/list');
  return response.data;
};

// Создать новый бэкап
export const createBackup = async (label: string = "manual"): Promise<{ message: string; filename: string }> => {
  const response = await api.post('/backup/create', { label });
  return response.data;
};

// Удалить бэкап
export const deleteBackup = async (filename: string): Promise<{ message: string }> => {
  const response = await api.delete(`/backup/delete/${filename}`);
  return response.data;
};

// Скачать бэкап (через Blob для поддержки авторизации)
export const downloadBackupFile = async (filename: string): Promise<void> => {
  const response = await api.get(`/backup/download/${filename}`, {
    responseType: 'blob', // Критично для бинарных данных
  });

  // Создаем временную ссылку для скачивания
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  
  // Чистим за собой
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
};