import axios from "axios";
import { getJwtFromLocalStorage } from "./utils";

export const apiClient = axios.create({
  baseURL: "http://localhost:3001/api/v1",
  withCredentials: false
});

apiClient.interceptors.request.use((config) => {
  const token = getJwtFromLocalStorage();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
