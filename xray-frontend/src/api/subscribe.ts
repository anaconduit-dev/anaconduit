import { api } from "./client";

export interface ConfigLink {
  tag: string;
  protocol: string;
  link: string;
}

export interface UserConfigResponse {
  user_email: string;
  links: ConfigLink[];
  link_subscription: string;
}

/** * Получить список всех ссылок (конфигов) пользователя и строку подписки 
 * @param userId - ID пользователя в системе
 * @param token
 */
export const getUserConfigLinks = async (userId: number) => {
  const res = await api.get(`/subscribe/${userId}/config-links`);
  return res.data;
};


