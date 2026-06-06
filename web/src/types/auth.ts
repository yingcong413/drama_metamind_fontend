// types/auth.ts —— 用户与登录态(含 PRD v0.9 §1.5 多账户字段)

import type { Organization } from "./org";

export type Locale = "zh-CN" | "en" | "fr";

export type MemberRole = "owner" | "member";
export type MemberStatus = "active" | "disabled";

export interface User {
  id: string;
  name: string;
  phone: string;                      // 已脱敏(138****8000)
  avatar_url: string | null;
  email?: string | null;

  // —— PRD v0.9 §1.5 多账户字段 ——
  /** 当前所在组织 id;后端 ensureUserHasOrg() 保证非空 */
  org_id: string | null;
  /** 当前在该 org 内的角色 */
  role: MemberRole;
  /** 账号状态;disabled 时登录会被拒 */
  status: MemberStatus;
  /** 加入当前 org 的时间(ISO);用于 7 天反悔窗口 */
  joined_at: string | null;
  /** 偏好语言;§9 i18n 联动 */
  preferred_language: Locale;
  /** 当前 org 的快照(后端 publicUser 一并返回,前端不用单独再拉 /org) */
  org: Organization | null;
  /** v0.9.1 §1.5.6 平台管理员标志;跨 org,与 role(Owner/Member) 正交 */
  is_platform_admin?: boolean;
  /** 验证账号:仅其能看到生成视频的提示词 / JSON(平台管理员设置) */
  is_verification_account?: boolean;
  /** 本月额度(分);0 或缺省 = 不限额 */
  monthly_quota_cents?: number;
}

export interface LoginResponse {
  token: string;
  expires_at: string;
  user: User;
}

/** 注册请求体 */
export interface RegisterRequest {
  phone: string;
  code: string;
  agree_terms: boolean;
  /** 账户类型;默认 personal */
  account_type?: "personal" | "enterprise";
  /** 选 enterprise 时必填 */
  org_name?: string;
}
