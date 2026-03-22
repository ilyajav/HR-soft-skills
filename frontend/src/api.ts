import { AxiosHeaders } from "axios";
import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getFirstNestedMessage = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  if (isRecord(value)) {
    const firstValue = Object.values(value)[0];
    return getFirstNestedMessage(firstValue);
  }

  return null;
};

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem("hr_token");
  if (token) {
    if (!(config.headers instanceof AxiosHeaders)) {
      config.headers = AxiosHeaders.from(config.headers);
    }

    config.headers.set("Authorization", `Token ${token}`);
  }

  return config;
});

export const getApiErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (!axios.isAxiosError(error)) {
    return fallbackMessage;
  }

  const data = error.response?.data;
  if (!data) {
    return fallbackMessage;
  }

  if (typeof data === "string") {
    return data;
  }

  if (isRecord(data) && typeof data.detail === "string") {
    return data.detail;
  }

  return getFirstNestedMessage(data) ?? fallbackMessage;
};

export default api;
