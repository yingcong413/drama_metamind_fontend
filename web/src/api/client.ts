import axios, { AxiosError, type AxiosInstance } from "axios";
import { ApiError, type ApiResponse } from "@/types";
import { useAuthStore } from "@/stores/auth";

/** 数据层(项目/角色/任务/账户)是否走 localStorage mock。 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

/**
 * 鉴权层是否走真实后端 /api/v1/auth/*。独立于 USE_MOCK,允许:
 *   - 纯 demo:USE_MOCK=true,  USE_REAL_AUTH=false → 一切走 localStorage
 *   - 内测:  USE_MOCK=true,  USE_REAL_AUTH=true  → 数据 mock,登录真实(当前生产配置)
 *   - 全真:  USE_MOCK=false, USE_REAL_AUTH=true  → 所有都走后端(待后端做完 projects/characters/tasks 端点后)
 */
export const USE_REAL_AUTH = import.meta.env.VITE_USE_REAL_AUTH === "true";

const baseURL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export const client: AxiosInstance = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (resp) => {
    const refreshed = resp.headers["x-refresh-token"];
    if (typeof refreshed === "string" && refreshed) {
      useAuthStore.getState().setToken(refreshed);
    }
    const body = resp.data as ApiResponse<unknown>;
    if (body && typeof body.code === "number") {
      if (body.code !== 0) {
        const fields = (body.data as { errors?: unknown } | undefined)?.errors;
        throw new ApiError(
          body.message || "请求失败",
          body.code,
          resp.status,
          Array.isArray(fields) ? (fields as ApiError["fields"]) : undefined,
        );
      }
      resp.data = body.data;
    }
    return resp;
  },
  (err: AxiosError<ApiResponse<unknown>>) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    const body = err.response?.data;
    if (body && typeof body.code === "number") {
      throw new ApiError(body.message || err.message, body.code, err.response?.status);
    }
    // 后端业务错误体 { code: "insufficient_balance", message } —— code 为字符串时也把 message 透出来
    if (body && typeof (body as { code?: unknown }).code === "string") {
      const b = body as unknown as { code: string; message?: string };
      throw new ApiError(b.message || err.message, -1, err.response?.status);
    }
    throw new ApiError(err.message || "网络错误", -1, err.response?.status);
  },
);

export async function get<T>(url: string, params?: unknown): Promise<T> {
  const resp = await client.get<T>(url, { params });
  return resp.data;
}

export async function post<T>(url: string, body?: unknown): Promise<T> {
  const resp = await client.post<T>(url, body);
  return resp.data;
}

export async function patch<T>(url: string, body?: unknown): Promise<T> {
  const resp = await client.patch<T>(url, body);
  return resp.data;
}

export async function del<T>(url: string): Promise<T> {
  const resp = await client.delete<T>(url);
  return resp.data;
}
