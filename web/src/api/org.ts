// api/org.ts —— PRD §3 多账户/组织相关端点客户端
//
// 真接口路径在后端 server/src/routes/org.ts;mock 模式下用 localStorage 维护一份
// 简化的成员列表,够 OrgPage 跑通。

// 跟 auth.ts 一致:org 属于鉴权 / 账户体系,看 USE_REAL_AUTH(=false 时走 mock),
// 不看 USE_MOCK(那是数据层 — characters/projects/tasks)。
// 这样 .env.production 里 VITE_USE_MOCK=true + VITE_USE_REAL_AUTH=true 时,
// org 调用真后端 /api/v1/org/*。
import { USE_REAL_AUTH, del, get, patch as httpPatch, post } from "./client";
const USE_MOCK = !USE_REAL_AUTH;
import type {
  CreateMemberRequest,
  CreateMemberResponse,
  OrgMember,
  Organization,
} from "@/types";
import { loadJSON, saveJSON } from "./_mockStorage";

// ────────── 类型 ──────────

export interface UpdateOrgRequest {
  name?: string;
  logo_url?: string | null;
}

export interface TransferRequest {
  to_user_id: string;
}

export interface DissolveResponse {
  ok: true;
  dissolved_org_id: string;
  restore_until: string;
}

export interface LeaveResponse {
  ok: true;
  new_org: Organization;
}

// ────────── 真接口 (USE_MOCK=false 走这里) ──────────

export function getOrg(): Promise<Organization> {
  if (USE_MOCK) return mockGetOrg();
  return get<Organization>("/org");
}

export function updateOrg(patch: UpdateOrgRequest): Promise<Organization> {
  if (USE_MOCK) return mockUpdateOrg(patch);
  return httpPatch<Organization>("/org", patch);
}

export function upgradeToEnterprise(orgName: string): Promise<Organization> {
  if (USE_MOCK) return mockUpgrade(orgName);
  return post<Organization>("/org/upgrade", { org_name: orgName });
}

export function listMembers(): Promise<OrgMember[]> {
  if (USE_MOCK) return mockListMembers();
  return get<OrgMember[]>("/org/members");
}

export function createMember(input: CreateMemberRequest): Promise<CreateMemberResponse> {
  if (USE_MOCK) return mockCreateMember(input);
  return post<CreateMemberResponse>("/org/members", input);
}

export function patchMember(userId: string, patch: { name?: string; status?: "active" | "disabled" }): Promise<OrgMember> {
  if (USE_MOCK) return mockPatchMember(userId, patch);
  return httpPatch<OrgMember>(`/org/members/${userId}`, patch);
}

export function resetMemberPassword(userId: string): Promise<{ new_password: string }> {
  if (USE_MOCK) return mockResetMemberPassword();
  return post<{ new_password: string }>(`/org/members/${userId}/reset_password`, {});
}

export function kickMember(userId: string): Promise<{ ok: true }> {
  if (USE_MOCK) return mockKickMember(userId);
  return del<{ ok: true }>(`/org/members/${userId}`);
}

export function transferOwner(toUserId: string): Promise<{ org: Organization }> {
  if (USE_MOCK) return mockTransfer(toUserId);
  return post<{ org: Organization }>("/org/transfer", { to_user_id: toUserId });
}

export function leaveOrg(): Promise<LeaveResponse> {
  if (USE_MOCK) return mockLeave();
  return post<LeaveResponse>("/org/leave", {});
}

export function dissolveOrg(): Promise<DissolveResponse> {
  if (USE_MOCK) return mockDissolve();
  return post<DissolveResponse>("/org/dissolve", {});
}

// ────────── Mock 实现 ──────────
//
// 同 mock 模式:一个 localStorage key 装组织成员列表;org 概要 / Owner 身份从
// `metamind-mock-v1-user_profile` 来(_mock.ts 中维护)。

interface MockMembersStore {
  members: OrgMember[];
}

function loadMembersStore(): MockMembersStore {
  return loadJSON<MockMembersStore>("mock_org_members", { members: [] });
}

function saveMembersStore(store: MockMembersStore) {
  saveJSON("mock_org_members", store);
}

async function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function mockGetOrg(): Promise<Organization> {
  await delay(80);
  // 直接复用 _mock.ts buildMockUser 拼出来的 user.org;这里独立按 profile 拼
  const profile = loadJSON<{ org_id?: string; org_name?: string; account_type?: "personal" | "enterprise"; name?: string }>("user_profile", {});
  const accountType = profile.account_type || "personal";
  return {
    id: profile.org_id || "org_mock",
    name: profile.org_name || (accountType === "enterprise" ? "未命名公司" : (profile.name || "你") + " 的工作室"),
    logo_url: null,
    owner_user_id: "u_mock",
    seat_limit: accountType === "enterprise" ? 20 : 1,
    account_type: accountType,
    status: "active",
    member_count: 1 + loadMembersStore().members.filter((m) => m.status === "active").length,
    created_at: new Date().toISOString(),
  };
}

async function mockUpdateOrg(patch: UpdateOrgRequest): Promise<Organization> {
  await delay(120);
  const profile = loadJSON<Record<string, unknown>>("user_profile", {});
  if (patch.name) profile.org_name = patch.name;
  saveJSON("user_profile", profile);
  return mockGetOrg();
}

async function mockUpgrade(orgName: string): Promise<Organization> {
  await delay(160);
  const profile = loadJSON<Record<string, unknown>>("user_profile", {});
  profile.account_type = "enterprise";
  profile.org_name = orgName;
  saveJSON("user_profile", profile);
  return mockGetOrg();
}

async function mockListMembers(): Promise<OrgMember[]> {
  await delay(120);
  const store = loadMembersStore();
  // 把 Owner 自己也加进去(从 user_profile)
  const profile = loadJSON<{ id?: string; name?: string; phone?: string; org_id?: string; joined_at?: string }>("user_profile", {});
  const ownerPhone = profile.phone || "13800138000";
  const owner: OrgMember = {
    user_id: profile.id || "u_mock",
    org_id: profile.org_id || "org_mock",
    name: profile.name || "你",
    phone: ownerPhone.slice(0, 3) + "****" + ownerPhone.slice(7),
    email: null,
    avatar_url: null,
    role: "owner",
    status: "active",
    joined_at: profile.joined_at || new Date().toISOString(),
    last_active_at: new Date().toISOString(),
  };
  return [owner, ...store.members];
}

async function mockCreateMember(input: CreateMemberRequest): Promise<CreateMemberResponse> {
  await delay(200);
  if (!/^1[3-9]\d{9}$/.test(input.phone)) {
    throw new Error("手机号格式不对");
  }
  const store = loadMembersStore();
  if (store.members.some((m) => m.phone.replace(/\*/g, "") || false)) {
    // mock 不做严格唯一性,简单往里加
  }
  const initPwd = input.init_password || Math.random().toString(36).slice(2, 10);
  const m: OrgMember = {
    user_id: "u_" + Date.now().toString(36),
    org_id: "org_mock",
    name: input.name || "成员" + input.phone.slice(-4),
    phone: input.phone.slice(0, 3) + "****" + input.phone.slice(7),
    email: null,
    avatar_url: null,
    role: "member",
    status: "active",
    joined_at: new Date().toISOString(),
    last_active_at: null,
  };
  store.members.push(m);
  saveMembersStore(store);
  return { member: m, init_password: initPwd };
}

async function mockPatchMember(userId: string, patch: { name?: string; status?: "active" | "disabled" }): Promise<OrgMember> {
  await delay(140);
  const store = loadMembersStore();
  const idx = store.members.findIndex((m) => m.user_id === userId);
  if (idx === -1) throw new Error("成员不存在");
  store.members[idx] = { ...store.members[idx], ...patch };
  saveMembersStore(store);
  return store.members[idx];
}

async function mockResetMemberPassword(): Promise<{ new_password: string }> {
  await delay(140);
  return { new_password: Math.random().toString(36).slice(2, 10) };
}

async function mockKickMember(userId: string): Promise<{ ok: true }> {
  await delay(140);
  const store = loadMembersStore();
  store.members = store.members.filter((m) => m.user_id !== userId);
  saveMembersStore(store);
  return { ok: true };
}

async function mockTransfer(toUserId: string): Promise<{ org: Organization }> {
  await delay(180);
  // mock 模式下:把 user_profile.role 改成 member,把指定 member 升 owner(本地视图层面)
  const store = loadMembersStore();
  const idx = store.members.findIndex((m) => m.user_id === toUserId);
  if (idx === -1) throw new Error("目标成员不存在");
  store.members[idx].role = "owner";
  saveMembersStore(store);
  const profile = loadJSON<Record<string, unknown>>("user_profile", {});
  profile.role = "member";
  saveJSON("user_profile", profile);
  return { org: await mockGetOrg() };
}

async function mockLeave(): Promise<LeaveResponse> {
  await delay(180);
  // mock 模式:重建一个个人 org
  const profile = loadJSON<Record<string, unknown>>("user_profile", {});
  profile.role = "owner";
  profile.account_type = "personal";
  profile.org_name = (profile.name as string || "你") + " 的工作室";
  saveJSON("user_profile", profile);
  return {
    ok: true,
    new_org: await mockGetOrg(),
  };
}

async function mockDissolve(): Promise<DissolveResponse> {
  await delay(220);
  // mock 模式:清成员列表,把账户回到 personal
  saveMembersStore({ members: [] });
  const profile = loadJSON<Record<string, unknown>>("user_profile", {});
  profile.account_type = "personal";
  profile.org_name = (profile.name as string || "你") + " 的工作室";
  saveJSON("user_profile", profile);
  return {
    ok: true,
    dissolved_org_id: "org_mock",
    restore_until: new Date(Date.now() + 30 * 86400_000).toISOString(),
  };
}
