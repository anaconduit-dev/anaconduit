import { api } from "./client";


export interface SystemStatusResponse {
    app_name: string;
    version: string;
    db_revision: string;
}

export const getSystemStatus = async (): Promise<SystemStatusResponse> => {
    const res = await api.get('/app/status');
    return res.data;
};

// Запрос к GitHub (только если нужно проверить обновление)
export const getLatestVersion = async () => {
    // Используем /releases (массив) или /releases/latest (объект)
    const res = await fetch('https://api.github.com/repos/anaconduit-dev/anaconduit/releases');
    if (!res.ok) throw new Error('Ошибка GitHub API');
    
    const data = await res.json();
    
    // ПРОВЕРКА: если это массив, берем 0-й элемент. Если объект - отдаем как есть.
    const latest = Array.isArray(data) ? data[0] : data;
    
    if (!latest) throw new Error('Релизы не найдены');
    return latest; 
};
