import { api } from "./client";

// --- CLIENTS (USERS) ---

/** Получить список всех пользователей */
export const getUsers = async () => {
  const res = await api.get("/client/get_user");
  return res.data;
};

/** Добавить клиента к конкретному инбаунду */
export const addClient = async (
  inboundId: number, 
  email: string, 
  clientUuid: string, 
  flow: string = "", 
  level: number = 0
) => {
  const params = new URLSearchParams();
  params.append("email", email);
  params.append("id_or_password", clientUuid);
  
  // Добавляем flow ТОЛЬКО если он не пустой
  if (flow && flow.trim() !== "") {
    params.append("flow", flow);
  }
  
  params.append("level", level.toString());

  const res = await api.post(`/client/${inboundId}/add-client?${params.toString()}`);
  return res.data;
};

/** Полное удаление пользователя из системы */
export const deleteFullUser = async (userId: number) => {
  await api.delete(`/client/remove/${userId}`);
};

/** Удаление пользователя только из конкретного инбаунда */
export const removeUserFromInbound = async (userId: number, inboundId: number) => {
  await api.delete(`/client/delete/${userId}/inbound/${inboundId}`);
};

/** Обновить лимиты трафика или дату истечения */
export const updateLimits = async (userId: number, limits: any) => {
  const res = await api.patch(`/client/update-limits/${userId}`, limits);
  return res.data;
};

/** Сбросить токен подписки (сгенерировать новую ссылку) */
export const resetSubscriptionToken = async (userId: number) => {
  const res = await api.post(`/client/users/${userId}/reset-token`);
  return res.data;
};


// --- TOOLS ---

/** Генерация пары ключей для Reality (Private/Public) */
export const generateXrayKeys = async () => {
  const res = await api.get("/xray/tools/gen-keys");
  return res.data;
};
