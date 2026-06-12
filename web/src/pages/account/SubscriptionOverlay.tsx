import { useEffect, useState } from "react";
import { CloseIcon, CheckIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";
import { PayMethodModal } from "./PayMethodModal";
import { loadPricingCfg, groupOf, tierMetrics, type TierMetrics } from "@/lib/pricing";

interface Props {
  credits: number | null;
  onClose: () => void;
  onBuyCredits: () => void;
}

interface Plan {
  tier: string;
  tag: string;
  off: number;
  orig: number;
  yr: number;
  yrTotal: number;
  per100: string;
  credits: number;
  img: number;
  sec: number;
  concurrent: number;
  popular?: boolean;
  top?: boolean;
  team?: boolean;
}

const PLANS: Record<"personal" | "team", Plan[]> = {
  personal: [
    { tier: "Starter", tag: "入门版", off: 37, orig: 133, yr: 83, yrTotal: 999, per100: "8.33", credits: 1000, img: 143, sec: 500, concurrent: 10 },
    { tier: "Plus", tag: "进阶版", off: 41, orig: 399, yr: 239, yrTotal: 2868, per100: "7.97", credits: 3000, img: 429, sec: 1500, concurrent: 13 },
    { tier: "Pro", tag: "专业版", off: 52, orig: 1064, yr: 509, yrTotal: 6108, per100: "6.36", credits: 8000, img: 1143, sec: 4000, concurrent: 16, popular: true },
    { tier: "Ultra", tag: "旗舰版", off: 59, orig: 2394, yr: 999, yrTotal: 11988, per100: "5.55", credits: 18000, img: 2571, sec: 9000, concurrent: 20 },
  ],
  team: [
    { tier: "Team", tag: "团队版", off: 65, orig: 4154, yr: 1579, yrTotal: 18948, per100: "5.85", credits: 27000, img: 3857, sec: 13500, concurrent: 32, team: true, popular: true },
    { tier: "Enterprise", tag: "企业版", off: 82, orig: 7077, yr: 2479, yrTotal: 29748, per100: "5.39", credits: 46000, img: 6571, sec: 23000, concurrent: 40, team: true, top: true },
  ],
};

const popularOf = (k: "personal" | "team") =>
  (PLANS[k].find((p) => p.popular) ?? PLANS[k][0]).tier;

export function SubscriptionOverlay({ credits, onClose, onBuyCredits }: Props) {
  const t = useT();
  const [kind, setKind] = useState<"personal" | "team">("personal");
  const [yearly, setYearly] = useState(true);
  const [selected, setSelected] = useState(() => popularOf("personal"));
  const [showPay, setShowPay] = useState(false);
  // 价格数据来自管理员在 /admin/pricing 配置的定价模型
  const [cfg] = useState(loadPricingCfg);

  const switchKind = (k: "personal" | "team") => {
    setKind(k);
    setSelected(popularOf(k));
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="sub-overlay show">
      <button className="sub-close" onClick={onClose}><CloseIcon /></button>
      <div className="sub-inner">
        <div className="sub-head">
          <h1 className="sub-title">{t("选择适合你的")} <b>{t("订阅方案")}</b></h1>
          <p className="sub-headsub">{t("解锁全部模型与更高额度，按月或按年灵活订阅。")}</p>
        </div>

        <div className="sub-toggles">
          <div className="seg-plan">
            <button className={cn(kind === "personal" && "active")} onClick={() => switchKind("personal")}>
              {t("个人版")}
            </button>
            <button className={cn(kind === "team" && "active")} onClick={() => switchKind("team")}>
              {t("企业版")} <span className="new-tag">New</span>
            </button>
          </div>
          <div className="bill-toggle">
            <span>{t("按月")}</span>
            <span className={cn("toggle", yearly && "on")} onClick={() => setYearly((v) => !v)} />
            <span className={yearly ? "on-lbl" : ""}>{t("按年")}</span>
            <span className="bill-save">{t("省 40%+")}</span>
          </div>
        </div>

        <div className="sub-meta">
          <div className="sub-credits-pill">
            {t("我的积分：")}<b>{credits?.toLocaleString() ?? "—"}</b>
            <button className="sub-buy" onClick={onBuyCredits}>{t("购买积分")}</button>
          </div>
          <button className="sub-biz">{t("企业定制方案")} →</button>
        </div>

        {showPay && (
          <PayMethodModal onClose={() => setShowPay(false)} onPick={() => setShowPay(false)} />
        )}

        <div className={cn("sub-grid", PLANS[kind].length === 2 && "two")}>
          {PLANS[kind].map((p, i) => {
            const grp = groupOf(cfg, kind, yearly);
            const tier = grp?.tiers[i];
            const m = tier ? tierMetrics(cfg, tier) : null;
            return (
              <SubCard
                key={p.tier}
                plan={p}
                metrics={m}
                yearly={yearly}
                selected={selected === p.tier}
                onSelect={() => setSelected(p.tier)}
                onSubscribe={() => { setSelected(p.tier); setShowPay(true); }}
                t={t}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SubCard({
  plan: p,
  metrics,
  yearly,
  selected,
  onSelect,
  onSubscribe,
  t,
}: {
  plan: Plan;
  metrics: TierMetrics | null;
  yearly: boolean;
  selected: boolean;
  onSelect: () => void;
  onSubscribe: () => void;
  t: (s: string) => string;
}) {
  // 4 个数对应 Credit 定价后台:立减(off) · 原价(orig) · 月费/年费(price) · 含 Credit(credits)
  const off = metrics?.off ?? p.off;
  const orig = metrics?.orig ?? p.orig;
  const price = metrics?.price ?? (yearly ? p.yr : p.orig);
  const credits = metrics?.credits ?? p.credits;
  const img = metrics ? Math.round(credits / 7) : p.img;
  const sec = metrics ? Math.round(credits / 2) : p.sec;
  const per = yearly ? t("年") : t("月");
  return (
    <div className={cn("sub-card", p.popular && "popular", selected && "selected")} onClick={onSelect}>
      {p.popular && <span className="pop-badge">{t("最受欢迎")}</span>}
      <div className="sc-head">
        <span className="sc-tier">{p.tier}</span>
        <span className="sc-off">{off}% OFF</span>
      </div>
      <div className="sc-tag">{t(p.tag)}</div>
      <div className="sc-price">
        <span className="sc-orig">¥{orig.toLocaleString()}</span>
        <span className="sc-now">¥{price.toLocaleString()}</span>
        <span className="sc-unit">CNY / {per}</span>
      </div>
      <button className="sub-btn" onClick={(e) => { e.stopPropagation(); onSubscribe(); }}>{t("订阅")}</button>
      <div className="sc-credits">
        <span className="cc-num">{credits.toLocaleString()}</span> Credits / {per}
        <div className="sc-chips">
          <span className="sc-chip">{t("约")} {img.toLocaleString()} {t("张图")}</span>
          <span className="sc-chip">{t("约")} {sec.toLocaleString()}s {t("视频")}</span>
        </div>
      </div>
      <div className="sc-div">{t("模型权益")}</div>
      <div className="sc-feat"><CheckIcon /><span><b>Seedance 2.0</b> {t("模型")}</span></div>
      <div className="sc-feat"><CheckIcon /><span><b>HappyHorse</b> {t("模型")}</span></div>
      <div className="sc-feat"><CheckIcon /><span>{p.concurrent} {t("路并发分镜")}</span></div>
      {p.team && (
        <>
          <div className="sc-div">{t("团队专属权益")}</div>
          <div className="sc-feat"><CheckIcon />{t("专属客户经理")}</div>
          <div className="sc-feat"><CheckIcon />{t("工作日标准技术支持")}</div>
          <div className="sc-feat"><CheckIcon />{t("团队席位管理")}</div>
          <div className="sc-feat"><CheckIcon />{t("团队项目与积分共享")}</div>
        </>
      )}
      <div className="sc-div">{t("更多权益")}</div>
      {p.team && <div className="sc-feat"><CheckIcon />{t("每日赠送 60 Credits")}</div>}
      <div className="sc-feat"><CheckIcon />{t("无水印导出")}</div>
      <div className="sc-feat"><CheckIcon />{t("1080p 高清导出")}</div>
      <div className="sc-feat"><CheckIcon />{t("更稳定的模型服务")}</div>
    </div>
  );
}
