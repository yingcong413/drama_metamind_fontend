import { USE_MOCK, post } from "./client";
import { mockLoginPassword, mockLoginPhone, mockSendSms } from "./_mock";
import type { LoginResponse } from "@/types";

export function sendSms(phone: string, scene: "login" | "signup" = "login"): Promise<{ expires_in: number; next_send_in: number }> {
  if (USE_MOCK) return mockSendSms();
  return post("/auth/sms/send", { phone, scene });
}

export function loginPhone(phone: string, code: string, remember = true): Promise<LoginResponse> {
  if (USE_MOCK) return mockLoginPhone(phone);
  return post<LoginResponse>("/auth/login", { method: "phone", phone, code, remember });
}

export function loginPassword(account: string, password: string, remember = true): Promise<LoginResponse> {
  if (USE_MOCK) return mockLoginPassword(account);
  return post<LoginResponse>("/auth/login", { method: "password", account, password, remember });
}

export function registerPhone(phone: string, code: string, agree: boolean): Promise<LoginResponse> {
  if (USE_MOCK) return mockLoginPhone(phone);
  return post<LoginResponse>("/auth/register", { phone, code, agree_terms: agree });
}
