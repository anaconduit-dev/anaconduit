import { api } from "./client";

// Опишем интерфейс ответа для TypeScript (если используешь его)
export interface ContainerMemory {
  usage_mb: number;
  limit_mb: number;
  percent: number;
}

export interface DockerContainer {
  name: string;
  status: 'running' | 'exited' | 'restarting' | 'not_found' | string;
  uptime: string;
  cpu_percent: number;
  memory: ContainerMemory;
  image: string[];
}

export interface DockerTotalStats {
  cpu_percent: number;
  mem_usage_mb: number;
  mem_usage_percent: number;
  count: number;
}

export interface DockerListResponse {
  containers: DockerContainer[];
  total: DockerTotalStats;
}

export const getDockerContainers = async (): Promise<DockerListResponse> => {
  const response = await api.get<DockerListResponse>('/docker/containers');
  return response.data;
};