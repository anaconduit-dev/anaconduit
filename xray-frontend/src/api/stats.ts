import { api } from "./client";


export const getStats = async () => {
  const res = await api.get("/stats/summary");
  return res.data;
};


export const getStatsSystem = async () => {
  const res = await api.get("/stats/system/summary");
  return res.data;
};