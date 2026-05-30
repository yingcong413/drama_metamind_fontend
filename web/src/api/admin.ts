// api/admin.ts —— 平台管理员操作(PRD §1.5.6 + §10.8.5)
//
// 本期只暴露 admin 手动充值相关 3 个端点;其它管理动作(调席位/解散 org 等)推迟。

import { USE_REAL_AUTH, get, post } from "./client";

const USE_MOCK_ADMIN = !USE_REAL_AUTH;

// ─────────── 类型 ───────────

export interface OrgSearchItem {
  id: string;
  name: string;
  account_type: "personal" | "enterprise";
  owner_name: string;
  owner_phone_masked: string;
  balance_cents: number;
}

export interface AdminRechargeRequest {
  org_id: string;
  /** 可正可负;负数 = 冲正 */
  amount_cents: number;
  bonus_cents?: number;
  method?: "admin_manual" | "refund";
  /** 必填(对账依据),2-200 字 */
  note: string;
}

export interface AdminRechargeRecord {
  id: string;
  org_id: string;
  org_name: string;
  amount_cents: number;
  bonus_cents: number;
  method: string;
  operator_user_id: string;
  operator_name: string;
  note: string | null;
  status: "success" | "refunded" | "pending";
  time: string;
}

export interface AdminRechargeResponse {
  recharge: AdminRechargeRecord;
  account: {
    org_id: string;
    balance_cents: number;
    lifetime_recharged_cents: number;
  };
}

export interface AdminListResponse<T> {
  list: T[];
  page: number;
  page_size: number;
  total: number;
}

// ─────────── 真接口 ───────────

export function searchOrgs(q: string): Promise<{ list: OrgSearchItem[] }> {
  if (USE_MOCK_ADMIN) return Promise.resolve({ list: [] });
  return get<{ list: OrgSearchItem[] }>("/admin/orgs/search", { q });
}

export function createAdminRecharge(
  input: AdminRechargeRequest,
): Promise<AdminRechargeResponse> {
  if (USE_MOCK_ADMIN) {
    return Promise.reject(new Error("mock 模式不支持 admin 充值;设 USE_REAL_AUTH=true"));
  }
  return post<AdminRechargeResponse>("/admin/recharges", input);
}

export function listAdminRecharges(
  page = 1,
  pageSize = 50,
): Promise<AdminListResponse<AdminRechargeRecord>> {
  if (USE_MOCK_ADMIN) {
    return Promise.resolve({ list: [], page, page_size: pageSize, total: 0 });
  }
  return get<AdminListResponse<AdminRechargeRecord>>("/admin/recharges", {
    page,
    page_size: pageSize,
  });
}

// ─────────── 管理员替人开企业账户 (v0.9.5 §1.5.6) ───────────

export interface CreateAdminOrgRequest {
  /** 11 位手机号(企业 Owner 用此手机号登录) */
  phone: string;
  /** 企业名称 2-30 字 */
  org_name: string;
  /** Owner 显示名,可选,缺省 "用户" + phone.slice(-4) */
  owner_name?: string;
  /**
   * 可选初始密码,6-64 位。
   * SMS 未接通 / 阿里云短信审核中时,管理员设个密码并转告客户,
   * 客户用手机号 + 密码登录,绕过验证码。
   * 已有密码的老用户传此字段会被覆盖(视为重置)。
   */
  initial_password?: string;
  /** 可选首笔充值,>0 触发 admin_manual 流水,2 位小数前端先转成分 */
  initial_balance_cents?: number;
  /** 有 initial_balance_cents 时必填,2-200 字(对账依据) */
  note?: string;
}

export interface CreateAdminOrgResponse {
  user: {
    id: string;
    phone: string | null;
    name: string;
    role: "owner";
    /** true = 后端为该手机号新建了 user */
    is_new: boolean;
    /** true = 本次请求带了 initial_password 并写到了 password_hash */
    password_set: boolean;
  };
  organization: {
    id: string;
    name: string;
    account_type: "enterprise";
    seat_limit: number;
  };
  account: {
    org_id: string;
    balance_cents: number;
    lifetime_recharged_cents: number;
  };
  initial_recharge: {
    id: string;
    amount_cents: number;
    method: string;
    time: string;
  } | null;
}

export function createAdminOrg(
  input: CreateAdminOrgRequest,
): Promise<CreateAdminOrgResponse> {
  if (USE_MOCK_ADMIN) {
    return Promise.reject(new Error("mock 模式不支持代开企业账户;设 USE_REAL_AUTH=true"));
  }
  return post<CreateAdminOrgResponse>("/admin/orgs", input);
}
