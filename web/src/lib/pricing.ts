// Credit 定价模型:管理员在 /admin/pricing 配置(存 localStorage),
// 订阅方案页(SubscriptionOverlay)按同一份配置算出前台展示的 4 个数:
//   立减% (off) · 原价 (orig) · 价格/月费 (price) · 含 Credit (credits)

export interface PricingTier {
  name: string;
  mult: number;
  color: string;
  fee: number;
}
export interface PricingGroup {
  key: string; // pm 个人月 · pa 个人年 · em 企业月 · ea 企业年
  title: string;
  tag: string;
  billing: "monthly" | "annual";
  tiers: PricingTier[];
}
export interface PricingCfg {
  baseMult: number;
  baseRate: number;
  roundStep: number;
  groups: PricingGroup[];
}

export const PRICING_CFG_KEY = "mm-pricing-config";

export const DEFAULT_PRICING_GROUPS: PricingGroup[] = [
  {
    key: "pm", title: "个人版 · 按月付", tag: "四层订阅 · 月付", billing: "monthly", tiers: [
      { name: "Starter", mult: 1.4, color: "oklch(72% .15 155)", fee: 65 },
      { name: "Plus", mult: 1.3, color: "oklch(70% .13 230)", fee: 215 },
      { name: "Pro", mult: 1.2, color: "oklch(78% .15 80)", fee: 588 },
      { name: "Max", mult: 1.1, color: "oklch(66% .2 5)", fee: 998 },
    ],
  },
  {
    key: "pa", title: "个人版 · 按年付", tag: "四层订阅 · 年付（默认=月费×12）", billing: "annual", tiers: [
      { name: "Starter", mult: 1.4, color: "oklch(72% .15 155)", fee: 780 },
      { name: "Plus", mult: 1.3, color: "oklch(70% .13 230)", fee: 2580 },
      { name: "Pro", mult: 1.2, color: "oklch(78% .15 80)", fee: 7056 },
      { name: "Max", mult: 1.1, color: "oklch(66% .2 5)", fee: 11976 },
    ],
  },
  {
    key: "em", title: "企业版 · 按月付", tag: "两层订阅 · 月付", billing: "monthly", tiers: [
      { name: "Team", mult: 1.1, color: "oklch(72% .15 155)", fee: 360 },
      { name: "Enterprise", mult: 1.05, color: "oklch(66% .2 5)", fee: 3200 },
    ],
  },
  {
    key: "ea", title: "企业版 · 按年付", tag: "两层订阅 · 年付（默认=月费×12）", billing: "annual", tiers: [
      { name: "Team", mult: 1.1, color: "oklch(72% .15 155)", fee: 4320 },
      { name: "Enterprise", mult: 1.05, color: "oklch(66% .2 5)", fee: 38400 },
    ],
  },
];

export const DEFAULT_PRICING_CFG: PricingCfg = {
  baseMult: 2.0,
  baseRate: 20,
  roundStep: 100,
  groups: DEFAULT_PRICING_GROUPS,
};

export function loadPricingCfg(): PricingCfg {
  try {
    const raw = localStorage.getItem(PRICING_CFG_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      return {
        baseMult: c.baseMult ?? 2.0,
        baseRate: c.baseRate ?? 20,
        roundStep: c.roundStep ?? 100,
        groups: Array.isArray(c.groups) && c.groups.length ? c.groups : DEFAULT_PRICING_GROUPS,
      };
    }
  } catch { /* 损坏即用默认 */ }
  return DEFAULT_PRICING_CFG;
}

export interface TierMetrics {
  off: number;     // 立减 %
  orig: number;    // 原价 ¥
  price: number;   // 月费 / 年费 ¥
  credits: number; // 月费含 / 年含 Credit
}

export function tierMetrics(cfg: PricingCfg, tier: PricingTier): TierMetrics {
  const anchor = 1 / (cfg.baseRate * cfg.baseMult);
  const mcRaw = tier.fee / tier.mult / anchor;
  const credits = Math.floor(mcRaw / cfg.roundStep) * cfg.roundStep;
  return {
    off: Math.round((1 - tier.mult / cfg.baseMult) * 100),
    orig: Math.round(credits / cfg.baseRate),
    price: Math.round(tier.fee),
    credits,
  };
}

export function groupOf(cfg: PricingCfg, kind: "personal" | "team", yearly: boolean): PricingGroup | undefined {
  const key = kind === "personal" ? (yearly ? "pa" : "pm") : (yearly ? "ea" : "em");
  return cfg.groups.find((g) => g.key === key);
}
