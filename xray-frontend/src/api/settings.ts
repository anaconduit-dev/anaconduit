import { api } from "./client";

/** * Получить текущие глобальные настройки Xray 
 * (domainStrategy, logLevel, статистика и т.д.)
 */
export const getGlobalSettings = async () => {
  const res = await api.get("/settings/get");
  return res.data;
};

/** * Обновить глобальные настройки.
 * Можно передавать объект целиком или только отдельные поля, например:
 * { domain_strategy: "IPIfNonMatch" }
 */
export const updateGlobalSettings = async (data: any) => {
  const res = await api.patch("/settings/update", data);
  return res.data;
};