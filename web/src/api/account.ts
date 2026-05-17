import { USE_MOCK, get } from "./client";
import { mockGetAccount, mockListPackages, mockListRecharges } from "./_mock";
import type { Account, RechargePackage, RechargeRecord } from "@/types";

export function getAccount(): Promise<Account> {
  if (USE_MOCK) return mockGetAccount();
  return get<Account>("/account");
}

export function listPackages(): Promise<RechargePackage[]> {
  if (USE_MOCK) return mockListPackages();
  return get<RechargePackage[]>("/account/packages");
}

export function listRecharges(): Promise<RechargeRecord[]> {
  if (USE_MOCK) return mockListRecharges();
  return get<RechargeRecord[]>("/account/recharges");
}
