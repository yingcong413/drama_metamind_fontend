// api/recharge.ts —— 自助充值(支付宝 / 微信) PRD v0.9.5 §10.8.6
//
// 走真后端 /v1/recharges/*。pure-mock(USE_REAL_AUTH=false)无后端,直接拒绝并提示。

import { USE_REAL_AUTH, get, post } from "./client";

export type PayMethod = "alipay" | "wechat_pay" | "stripe";

export interface CreateOrderResp {
  recharge_id: string;
  out_trade_no: string;
  method: PayMethod;
  /** 计入余额的人民币分 */
  amount_cents: number;
  /** stripe 时为美元分(向账户收的金额),否则 null */
  usd_cents: number | null;
  /** stripe 时为 1 USD = ? CNY 实时汇率,否则 null */
  rate: number | null;
  qr_code: string | null;
  pay_url: string | null;
  is_stub: boolean;
}

export interface OrderStatusResp {
  recharge_id: string;
  out_trade_no: string | null;
  method: string;
  amount_cents: number;
  status: "pending" | "success" | "failed";
  paid_at: string | null;
}

export function createRechargeOrder(input: { amount_cents: number; method: PayMethod }): Promise<CreateOrderResp> {
  if (!USE_REAL_AUTH) {
    return Promise.reject(new Error("当前为本地 mock 模式，自助充值需连后端（USE_REAL_AUTH=true）"));
  }
  return post<CreateOrderResp>("/recharges/orders", input);
}

export function getRechargeOrder(id: string): Promise<OrderStatusResp> {
  return get<OrderStatusResp>(`/recharges/orders/${id}`);
}

export function mockPayOrder(id: string): Promise<{ ok: boolean; already_paid: boolean; status: string }> {
  return post<{ ok: boolean; already_paid: boolean; status: string }>(`/recharges/orders/${id}/mock-pay`, {});
}
