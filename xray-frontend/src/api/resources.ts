import { api } from "./client";

export interface XrayResource {
    id: number;
    filename: string;
    url: string;
    auto_update: boolean;
    update_interval: number;
    last_updated: string | null;
    status: 'pending' | 'success' | 'failed';
    error_message: string | null;
}

export interface ResourceCreate {
    filename: string;
    url: string;
    auto_update: boolean;
    update_interval: number;
}

export const getResources = async (): Promise<XrayResource[]> => {
    const res = await api.get('/resource/get');
    return res.data;
};

export const addResource = async (data: ResourceCreate): Promise<XrayResource> => {
    const res = await api.post('/resource/add', data);
    return res.data;
};

export const updateResource = async (id: number, data: Partial<ResourceCreate>): Promise<XrayResource> => {
    const res = await api.patch(`/resource/update/${id}`, data);
    return res.data;
};

export const deleteResource = async (id: number): Promise<void> => {
    await api.delete(`/resource/remove/${id}`);
};

export const syncResource = async (id?: number): Promise<{status: string}> => {
    const url = id ? `/resource/sync/${id}` : '/resource/sync';
    const res = await api.post(url);
    return res.data;
};