// api/account.ts —— 账户余额 + 充值流水
//
// PRD §10.8.5 落地:USE_REAL_AUTH=true 时走真后端 /api/v1/account 与 /api/v1/recharges。
// 与 org.ts / tasks.ts 一致 — 账户/计费属于鉴权 + 财务体系,跟着 USE_REAL_AUTH 跑,
// 不跟 USE_MOCK(那是 characters/projects 数据层)。

import { USE_REAL_AUTH, get } from "./client";
import { mockGetAccount, mockListPackages, mockListRecharges } from "./_mock";
import type { Account, Pagination, RechargePackage, RechargeRecord } from "@/types";

const USE_MOCK_ACCOUNT = !USE_REAL_AUTH;

export function getAccount(): Promise<Account> {
  if (USE_MOCK_ACCOUNT) return mockGetAccount();
  return get<Account>("/account");
}

export function listPackages(): Promise<RechargePackage[]> {
  // 充值套餐目前后端无端点,沿用 mock(本期不接通在线支付,§10.8.3)
  return mockListPackages();
}

export function listRecharges(): Promise<RechargeRecord[]> {
  if (USE_MOCK_ACCOUNT) return mockListRecharges();
  // 真后端返回 Pagination<>,这里展开成原 RechargeRecord[](兼容现有 UI)
  return get<Pagination<RechargeRecord>>("/recharges").then((r) => r.list ?? []);
}
