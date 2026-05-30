import { USE_REAL_AUTH, patch, post } from "./client";
import {
  mockChangePassword,
  mockLoginPassword,
  mockLoginPhone,
  mockRegister,
  mockSendSms,
  mockUpdateUser,
} from "./_mock";
import type { Locale, LoginResponse, RegisterRequest } from "@/types";

// 鉴权用 USE_REAL_AUTH 判定:为 false 则走 mock(localStorage),为 true 则打真实后端 /api/v1/auth/*。
// 跟 USE_MOCK(数据层)解耦,允许"数据 mock 但鉴权真"的内测形态。
const USE_MOCK_AUTH = !USE_REAL_AUTH;

export function sendSms(phone: string, scene: "login" | "signup" = "login"): Promise<{ expires_in: number; next_send_in: number }> {
  if (USE_MOCK_AUTH) return mockSendSms();
  return post("/auth/sms/send", { phone, scene });
}

export function loginPhone(phone: string, code: string, remember = true): Promise<LoginResponse> {
  if (USE_MOCK_AUTH) return mockLoginPhone(phone);
  return post<LoginResponse>("/auth/login", { method: "phone", phone, code, remember });
}

export function loginPassword(account: string, password: string, remember = true): Promise<LoginResponse> {
  if (USE_MOCK_AUTH) return mockLoginPassword(account);
  return post<LoginResponse>("/auth/login", { method: "password", account, password, remember });
}

/**
 * 注册。account_type=enterprise 时必填 org_name。
 * mock 模式下:用 mockRegister 把账户类型 / 组织名持久化进 user_profile。
 */
export function registerPhone(input: RegisterRequest): Promise<LoginResponse> {
  if (USE_MOCK_AUTH) {
    return mockRegister({
      phone: input.phone,
      account_type: input.account_type,
      org_name: input.org_name,
    });
  }
  return post<LoginResponse>("/auth/register", {
    phone: input.phone,
    code: input.code,
    agree_terms: input.agree_terms,
    account_type: input.account_type || "personal",
    org_name: input.org_name,
  });
}

/** 改昵称或偏好语言。返回简化 { name?, preferred_language? } 局部对象。 */
export function updateUser(body: { name?: string; preferred_language?: Locale }): Promise<{ name?: string; preferred_language?: Locale }> {
  if (USE_MOCK_AUTH) {
    return mockUpdateUser(body).then((p) => ({
      name: p.name,
      preferred_language: p.preferred_language,
    }));
  }
  return patch<{ name?: string; preferred_language?: Locale }>("/auth/me", body);
}

export function changePassword(body: {
  old_password: string;
  new_password: string;
}): Promise<{ ok: true }> {
  if (USE_MOCK_AUTH) return mockChangePassword(body);
  return post<{ ok: true }>("/auth/password", body);
}
