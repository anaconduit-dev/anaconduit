import axios from "axios";

// Получаем префикс API из текущего URL
const pathParts = window.location.pathname.split("/").filter(Boolean);
const secretPath = pathParts[0] || ""; // первый сегмент — SECRET_PATH

export const api = axios.create({
  baseURL: `/${secretPath}/`,
});

export async function login(username: string, password: string) {
  const form = new URLSearchParams();

  form.append("grant_type", "password");
  form.append("username", username);
  form.append("password", password);

  const res = await api.post("/auth/login", form, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return res.data;
}

api.interceptors.request.use(config => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
