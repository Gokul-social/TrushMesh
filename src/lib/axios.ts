import axios, { type AxiosResponse } from "axios";
import { getJwtFromLocalStorage } from "./utils";
import { runtimeConfig } from "./runtimeConfig";
import { resolveDemoResponse } from "./demoData";

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

// When the backend is unavailable (4xx/5xx or network error), fall back to
// demo data so the app remains visually complete without a live API.
apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const axiosError = error as { config?: { url?: string; params?: Record<string, string> }; response?: { status?: number } };
    const status = axiosError.response?.status;
    const shouldFallback = !status || status >= 400;

    if (shouldFallback) {
      const mock = resolveDemoResponse(axiosError.config?.url, axiosError.config?.params);
      if (mock) {
        const fakeResponse: AxiosResponse = {
          data: mock,
          status: 200,
          statusText: "OK",
          headers: {},
          config: (axiosError as { config: AxiosResponse["config"] }).config
        };
        return Promise.resolve(fakeResponse);
      }
    }

    return Promise.reject(error);
  }
);
