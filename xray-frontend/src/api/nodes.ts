import { api } from "./client";

/** Интерфейс объекта Ноды */
export interface Node {
  id: number;
  name: string;
  address: string;
  api_url: string;
  reality_server_address: string;
  is_active: boolean;
  
  // Версионность конфига
  desired_version: number;
  applied_version: number;
  
  // Статус
  last_heartbeat: string | null; // Приходит строкой ISO
}

/** Тип для создания новой ноды */
export interface NodeCreate {
  name: string;
  address: string;
  api_url: string;
  reality_server_address: string;
  is_active?: boolean;
  secret_token?: string; // Опционально, так как сервер может сгенерировать сам
}

/** Тип для обновления ноды (все поля опциональны) */
export interface NodeUpdate extends Partial<NodeCreate> {}

/** Ответ при генерации нового токена */
export interface RotateTokenResponse {
  status: string;
  new_token: string;
  warning: string;
}

/** Получить список всех нод */
export const getNodes = async (): Promise<Node[]> => {
  const res = await api.get<Node[]>("/nodes/all");
  return res.data;
};

/** Зарегистрировать новую ноду */
export const registerNode = async (data: NodeCreate): Promise<Node> => {
  const res = await api.post<Node>("/nodes/register", data);
  return res.data;
};

/** Обновить данные ноды */
export const updateNode = async (id: number, data: NodeUpdate): Promise<Node> => {
  const res = await api.patch<Node>(`/nodes/update/${id}`, data);
  return res.data;
};

/** Удалить ноду */
export const deleteNode = async (id: number): Promise<{ status: string; message: string }> => {
  const res = await api.delete(`/nodes/delete/${id}`);
  return res.data;
};

/** Сгенерировать новый секретный токен для ноды */
export const rotateNodeToken = async (id: number): Promise<RotateTokenResponse> => {
  const res = await api.post<RotateTokenResponse>(`/nodes/${id}/rotate-token`);
  return res.data;
};