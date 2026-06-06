export interface Account {
  user_id: string;
  balance_cents: number;
  gift_balance_cents: number;
  this_month: {
    spent_cents: number;
    generated_count: number;
    duration_seconds: number;
    /** 上月消费(分),用于「较上月」环比;旧后端可能不返回 */
    prev_month_spent_cents?: number;
  };
  last_recharge: {
    amount_cents: number;
    time: string;
    bonus_cents: number;
  } | null;
  lifetime: {
    spent_cents: number;
    recharged_cents: number;
  };
}

export interface RechargePackage {
  id: string;
  label: string;
  price_cents: number;
  credits_cents: number;
  bonus_cents: number;
  badge: string | null;
  per_unit_cents: number;
}

export type RechargeMethod = "wechat" | "alipay" | "stripe" | "bank";
export type RechargeStatus = "pending" | "success" | "failed" | "expired";

export interface RechargeRecord {
  id: string;
  time: string;
  method: string;
  amount_cents: number;
  credits_cents: number;
  bonus_cents: number;
  status: RechargeStatus;
}
