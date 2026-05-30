// types/org.ts —— PRD v0.9 §3 + §1.5 组织 / 主子账号

export type AccountType = "personal" | "enterprise";
export type OrgStatus = "active" | "dissolved";

export interface Organization {
  id: string;                  // org_xxx
  name: string;
  logo_url: string | null;
  owner_user_id: string;
  /** 席位上限;默认 20,由平台管理员配置 */
  seat_limit: number;
  account_type: AccountType;
  status: OrgStatus;
  /** 已 active 成员数量;后端聚合返回 */
  member_count?: number;
  created_at: string;
}

export interface OrgMember {
  user_id: string;
  org_id: string | null;
  name: string;
  phone: string;               // 已脱敏
  email: string | null;
  avatar_url: string | null;
  role: "owner" | "member";
  status: "active" | "disabled";
  joined_at: string | null;
  last_active_at: string | null;
}

export interface CreateMemberRequest {
  phone: string;
  name?: string;
  init_password?: string;
}

export interface CreateMemberResponse {
  member: OrgMember;
  /** 服务端生成的初始密码;Owner 转告 member */
  init_password: string;
}
