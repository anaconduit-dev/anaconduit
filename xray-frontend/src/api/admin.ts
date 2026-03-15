import { api } from "./client";

/**
 * Интерфейс для обновления данных администратора
 */
export interface AdminUpdateData {
  current_password: string;
  new_username: string;
  new_password: string;
}

/**
 * Результат обновления данных
 */
export interface AdminUpdateResponse {
  status: string;
  message: string;
}

/**
 * Отправляет запрос на смену логина и пароля
 */
export const updateAdminCredentials = async (data: AdminUpdateData): Promise<AdminUpdateResponse> => {
  const response = await api.put('/admin/update-credentials', data);
  return response.data;
};