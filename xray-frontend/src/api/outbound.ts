import { api } from "./client";

/** Получить список всех исходящих подключений (Outbounds) */
export const getOutbounds = async () => {
  const res = await api.get("/outbound/get_outbounds");
  return res.data;
};

/** Добавить новый аутбаунд (freedom, socks, blackhole и т.д.) */
export const addOutbound = async (data: any) => {
  const res = await api.post("/outbound/add", data);
  return res.data;
};

/** Удалить аутбаунд по ID */
export const deleteOutbound = async (id: number) => {
  const res = await api.delete(`/outbound/delete/${id}`);
  return res.data;
};

/** Обновить настройки аутбаунда */
export const updateOutbound = async (id: number, data: any) => {
  const res = await api.patch(`/outbound/update/${id}`, data);
  return res.data;
};

/** --- Routing Rules (Правила маршрутизации) --- */

/** Получить все правила маршрутизации */
export const getRoutingRules = async () => {
  const res = await api.get("/routing/all");
  return res.data;
};

/** Добавить новое правило маршрутизации */
export const addRoutingRule = async (data: any) => {
  const res = await api.post("/routing/add", data);
  return res.data;
};

/** Обновить правило (приоритет, домены, теги) */
export const updateRoutingRule = async (id: number, data: any) => {
  const res = await api.patch(`/routing/update/${id}`, data);
  return res.data;
};

/** Удалить правило маршрутизации */
export const deleteRoutingRule = async (id: number) => {
  const res = await api.delete(`/routing/delete/${id}`);
  return res.data;
};