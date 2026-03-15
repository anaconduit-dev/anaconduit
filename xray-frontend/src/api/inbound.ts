import { api } from "./client";

/** Получить список всех входящих подключений */
export const getInbounds = async () => {
  const res = await api.get("/inbound/get_inbounds_all");
  return res.data;
};

/** Добавить новый инбаунд */
export const addInbound = async (data: any) => {
  const res = await api.post("/inbound/add", data);
  return res.data;
};

/** Удалить инбаунд по ID */
export const deleteInbound = async (id: number) => {
  await api.delete(`/inbound/delete/${id}`);
};

/** Получить все активные ресурсы (порты, пути и т.д.) */
export const getActiveResources = async () => {
  const res = await api.get("/inbound/get_all_active_resources");
  return res.data;
};

/** Получить кастомный конфиг Xray */
export const getCustomConfig = async () => {
  const res = await api.get("/custom_config/get_custom_config");
  return res.data;
};

/** Обновить кастомный конфиг */
export const updateCustomConfig = async (config: string) => {
  const res = await api.post("/custom_config/update_custom_config", { config });
  return res.data;
};


/** Получить детальную информацию об инбаунде по ID */
export const getInboundById = async (id: number) => {
  // Важно: возвращаем весь ответ, так как в модалке мы используем res.data
  return await api.get(`/inbound/get/${id}`);
};

/** Обновить существующий инбаунд */
export const updateInbound = async (id: number, data: any) => {
  // Используем PATCH, так как мы обновляем существующий ресурс
  const res = await api.patch(`/inbound/update/${id}`, data);
  return res.data;
};