import { api } from "./client";

export interface Template {
  id: number;
  name: string;
  client_type: 'json' | 'clash' | 'sing-box';
  content: string;
  injection_tag: string;
  description: string;
}

export interface UserGroup {
  id: number;
  name: string;
  template_id: number | null;
}


export const getTemplates = () => api.get<Template[]>('/templates/get').then(r => r.data);
export const addTemplate = (data: Partial<Template>) => api.post<Template>('/templates/add', data).then(r => r.data);
export const updateTemplate = (id: number, data: Partial<Template>) => api.put<Template>(`/templates/update/${id}`, data).then(r => r.data);
export const deleteTemplate = (id: number) => api.delete(`/templates/delete/${id}`);


export const getGroups = () => 
  api.get<UserGroup[]>('/groups/get').then(r => r.data);

export const getGroupById = (id: number) => 
  api.get<UserGroup>(`/groups/get/${id}`).then(r => r.data);

export const addGroup = (data: Partial<UserGroup>) => 
  api.post<UserGroup>('/groups/add', data).then(r => r.data);

export const updateGroup = (id: number, data: Partial<UserGroup>) => 
  api.patch<UserGroup>(`/groups/update/${id}`, data).then(r => r.data);

export const deleteGroup = (id: number) => 
  api.delete(`/groups/remove/${id}`);


// --- Управление пользователями в группах ---

export const attachUser = (user_id: number, group_id: number) => 
  api.post('/groups/attach-user', { user_id, group_id });

export const detachUser = (user_id: number, group_id: number) => 
  api.post('/groups/detach-user', { user_id, group_id });

export const bulkAttachUsers = (group_id: number, user_ids: number[]) => 
  api.post(`/groups/${group_id}/bulk-attach`, user_ids);

export const getGroupUsers = (group_id: number) => 
  api.get(`/groups/${group_id}/users`).then(r => r.data);