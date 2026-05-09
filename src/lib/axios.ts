import axios from "axios";
import { getJwtFromLocalStorage } from "./utils";
import { runtimeConfig } from "./runtimeConfig";

export const apiClient = axios.create({
  baseURL: runtimeConfig.apiBaseUrl,
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
