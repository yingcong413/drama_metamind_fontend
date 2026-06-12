import { useState } from "react";
import { Navigate } from "react-router-dom";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { useIsPlatformAdmin } from "@/stores/auth";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import {
  DEFAULT_PRICING_GROUPS, PRICING_CFG_KEY, loadPricingCfg,
  type PricingGroup as Group, type PricingTier as Tier,
} from "@/lib/pricing";

const MULT_OPTS = [2.0, 1.4, 1.3, 1.2, 1.1, 1.05];
const ROUND_OPTS = [{ v: 100, l: "100" }, { v: 10, l: "10" }, { v: 1, l: "1（不取整）" }];

const fmt = (n: number, dp: number) =>
  !isFinite(n) ? "—" : n.toLocaleString("zh-CN", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const money = (n: number) => {
  const a = Math.abs(n);
  const dp = a >= 1 ? 2 : a >= 0.01 ? 3 : a >= 0.0001 ? 5 : 7;
  return "¥" + fmt(n, dp);
};
const intC = (n: number) => fmt(Math.round(n), 0);

export function AdminPricingPage() {
  const isAdmin = useIsPlatformAdmin();
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <PricingBody />;
}

function PricingBody() {
  const t = useT();
  const [baseMult, setBaseMult] = useState(() => loadPricingCfg().baseMult);
  const [baseRate, setBaseRate] = useState(() => loadPricingCfg().baseRate);
  const [testCost, setTestCost] = useState(5);
  const [testMult, setTestMult] = useState(2.0);
  const [roundStep, setRoundStep] = useState(() => loadPricingCfg().roundStep);
  const [groups, setGroups] = useState<Group[]>(() => loadPricingCfg().groups ?? DEFAULT_PRICING_GROUPS);
  const [saved, setSaved] = useState(false);

  const anchor = 1 / (baseRate * baseMult); // ¥ / 1 Credit(成本基准)

  const save = () => {
    localStorage.setItem(PRICING_CFG_KEY, JSON.stringify({ baseMult, baseRate, roundStep, groups }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const setTier = (gi: number, ti: number, patch: Partial<Tier>) =>
    setGroups((gs) => gs.map((g, i) => (i !== gi ? g : { ...g, tiers: g.tiers.map((tr, j) => (j !== ti ? tr : { ...tr, ...patch })) })));

  // ── 测试一次调用 ──
  const raw = testCost / anchor;
  const deduct = Math.ceil(raw / roundStep) * roundStep;
  const pay = deduct * anchor * testMult;
  const margin = pay - testCost;
  const marginRate = testCost > 0 ? (margin / testCost) * 100 : 0;
  const bonusY = (deduct - raw) * anchor * testMult;

  return (
    <>
      <AppTopBar crumbs={[{ label: t("平台管理") }, { label: t("Credit 定价") }]} />
      <div className="adm-usage pric-page">
        <div className="adm-head">
          <div>
            <div className="eyebrow">ADMIN · {t("平台管理")}</div>
            <h1 className="adm-h1">{t("Credit 定价后台")}</h1>
            <div className="adm-sub">
              {t("充值档为按量付费基准；个人 / 企业各含月付、年付共四套订阅，共用倍率与折扣逻辑。")}
              <span style={{ color: "var(--accent)" }}>{t("强调色")}</span>
              {t("列为自动填入定价页的前台字段，其余为后台核算。")}
            </div>
          </div>
          <button className={cn("btn", "btn-primary", "pric-save", saved && "ok")} onClick={save}>
            {saved ? `✓ ${t("已保存生效")}` : t("保存生效")}
          </button>
        </div>

        {/* 1 · 充值档 */}
        <div className="pric-card">
          <h2 className="pric-h2"><span className="num">1</span>{t("充值档")} <span className="tag">{t("按量充值 · 无月费 · 折扣基准")}</span></h2>
          <div className="pric-globals">
            <div className="pric-field">
              <label>{t("毛利倍率")} <span className="hint">{t("售价÷成本")}</span></label>
              <div className="pric-inrow">
                <input type="number" min={1} step={0.05} value={baseMult} onChange={(e) => setBaseMult(parseFloat(e.target.value) || 2)} />
                <span className="suffix">×</span>
              </div>
            </div>
            <div className="pric-field">
              <label>¥1 = {t("多少 Credit")} <span className="hint">{t("充值档兑换率")}</span></label>
              <div className="pric-inrow">
                <input type="number" min={1} step={1} value={baseRate} onChange={(e) => setBaseRate(parseFloat(e.target.value) || 20)} />
                <span className="suffix">Credit / ¥1</span>
              </div>
            </div>
          </div>
          <div className="pric-note">
            {t("此档按量充值、无月费,单价最贵。")}
            <b>{t("¥1 = 此处设定的 Credit 数(默认 20)是全站固定兑换率")}</b>
            {t(",所有订阅档都用它,不另设比例;各档的差异来自购买时的")}
            <b>{t("折扣(立减)")}</b>
            {t("不同——折扣越大,同样的钱拿到越多 Credit(多送)。")}
          </div>
        </div>

        {/* 2 · 测试一次调用 */}
        <div className="pric-card">
          <h2 className="pric-h2"><span className="num">2</span>{t("测试一次调用")} <span className="tag">{t("验证用")}</span></h2>
          <div className="pric-test-controls">
            <div className="pric-field">
              <label>{t("本次真实成本")} <span className="hint">{t("Token × 单价")}</span></label>
              <div className="pric-inrow">
                <input type="number" min={0} step={0.1} value={testCost} onChange={(e) => setTestCost(parseFloat(e.target.value) || 0)} />
                <span className="suffix">¥</span>
              </div>
            </div>
            <div className="pric-field">
              <label>{t("客户档位倍率")} <span className="hint">{t("只影响实付/毛利,不影响扣分")}</span></label>
              <div className="pric-toggle">
                {MULT_OPTS.map((m) => (
                  <button key={m} className={cn("pric-opt", m === testMult && "active")} onClick={() => setTestMult(m)}>
                    {(m % 1 === 0 ? fmt(m, 1) : fmt(m, 2)) + "×"}
                  </button>
                ))}
              </div>
            </div>
            <div className="pric-field">
              <label>{t("向上取整到")} <span className="hint">{t("卖方有利")}</span></label>
              <div className="pric-toggle">
                {ROUND_OPTS.map((o) => (
                  <button key={o.v} className={cn("pric-opt", o.v === roundStep && "active")} onClick={() => setRoundStep(o.v)}>{o.l}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="pric-out">
            <div className="cell"><div className="lbl">{t("精确应扣")}</div><div className="v dim">{fmt(raw, 1)} <small>Credit</small></div><div className="sub">{t("未取整")}</div></div>
            <div className="cell"><div className="lbl">{t("实际应扣(取整后)")}</div><div className="v deduct">{intC(deduct)} <small>Credit</small></div><div className="sub">{roundStep > 1 ? `${t("向上取整到")} ${roundStep}` : t("未取整")}</div></div>
            <div className="cell"><div className="lbl">{t("客户等值实付")}</div><div className="v">{money(pay)}</div><div className="sub">@ {fmt(testMult, 1)}× {t("档位")}</div></div>
            <div className="cell"><div className="lbl">{t("你的毛利")}</div><div className="v good">{money(margin)} <span className="pct">{fmt(marginRate, 1)}%</span></div><div className="sub">{t("含取整红利")} {money(bonusY)}</div></div>
          </div>
          <div className="pric-tnote">
            {t("不管个人/企业、月付/年付、哪一档,这次调用都扣")} <b>{intC(deduct)}</b> {t("Credit(扣分与倍率无关)。倍率只改变这些 Credit 值多少钱、你赚多少。")}
            {roundStep > 1 ? ` ${t("向上取整额外赚")} ${money(bonusY)}。` : ""}
          </div>
        </div>

        {/* 3-6 · 四套订阅 */}
        {groups.map((grp, gi) => {
          const feeLabel = grp.billing === "annual" ? t("年费") : t("月费");
          const creditLabel = grp.billing === "annual" ? t("年含 Credit") : t("月费含 Credit");
          const marginLabel = grp.billing === "annual" ? t("该年费毛利") : t("该月费毛利");
          return (
            <div className="pric-card" key={grp.key}>
              <h2 className="pric-h2"><span className="num">{gi + 3}</span>{t(grp.title)} <span className="tag">{t(grp.tag)}</span></h2>
              <div className="pric-tablewrap">
                <table className="pric-table">
                  <thead>
                    <tr>
                      <th>{t("档位名称")}</th>
                      <th>{t("毛利倍率")}<span className="sh">{t("售价÷成本 · 手填")}</span></th>
                      <th className="pub">{t("多送")}<span className="sh">{t("vs 充值档")}</span></th>
                      <th className="pub">{t("立减")}<span className="sh">{t("购买折扣")}</span></th>
                      <th className="pub">{feeLabel}<span className="sh">{t("手填 · 联动")}</span></th>
                      <th>{t("原价")}<span className="sh">{t("含Credit ÷ 兑换率")}</span></th>
                      <th className="pub">{creditLabel}<span className="sh">{t("向下取整发放")}</span></th>
                      <th>{marginLabel}<span className="sh">{t("取整后实算")}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {grp.tiers.map((tr, ti) => {
                      const sendPct = (baseMult / tr.mult - 1) * 100;
                      const offPct = (1 - tr.mult / baseMult) * 100;
                      const mcRaw = tr.fee / tr.mult / anchor;
                      const mcCredit = Math.floor(mcRaw / roundStep) * roundStep;
                      const realMargin = tr.fee - mcCredit * anchor;
                      const mRate = tr.fee > 0 ? (realMargin / tr.fee) * 100 : 0;
                      return (
                        <tr key={ti}>
                          <td>
                            <div className="tier-name">
                              <span className="pill" style={{ background: tr.color }} />
                              <input type="text" value={tr.name} onChange={(e) => setTier(gi, ti, { name: e.target.value })} />
                            </div>
                          </td>
                          <td><input className="cell mult" type="number" min={1} step={0.05} value={tr.mult} onChange={(e) => setTier(gi, ti, { mult: parseFloat(e.target.value) || 1 })} /></td>
                          <td><span className="pub">+{fmt(sendPct, 1)}%</span></td>
                          <td><span className="pub">{fmt(offPct, 1)}% OFF</span></td>
                          <td>
                            <input className="cell pub" type="number" min={0} step={1} value={Math.round(tr.fee * 100) / 100} onChange={(e) => setTier(gi, ti, { fee: parseFloat(e.target.value) || 0 })} />
                            {grp.billing === "annual" && <span className="ovr">≈ ¥{fmt(tr.fee / 12, 0)}/{t("月")}</span>}
                          </td>
                          <td><span className="orig">{money(mcCredit / baseRate)}</span></td>
                          <td>
                            <input className="cell pub" type="number" min={0} step={1} value={mcCredit} onChange={(e) => setTier(gi, ti, { fee: (parseFloat(e.target.value) || 0) * anchor * tr.mult })} />
                            <span className="ovr">↔ {t("联动 · 向下取整到")} {roundStep}</span>
                          </td>
                          <td><span className="good">{money(realMargin)}<span className="pct">{fmt(mRate, 1)}%</span></span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {gi === groups.length - 1 && (
                <div className="pric-legend">
                  <span className="k"><span className="sw" style={{ background: "var(--text-secondary)" }} />{t("手填")}</span>
                  <span className="k"><span className="sw" style={{ background: "var(--accent)" }} />{t("前台输出(自动填到定价页)")}</span>
                  <span className="k"><span className="sw" style={{ background: "var(--success)" }} />{t("毛利")}</span>
                  <div style={{ marginTop: 8 }}>
                    <b>{t("费用")}</b> {t("与")} <b>{t("含 Credit")}</b> {t("双向联动;发放 Credit 按上方粒度")} <b>{t("向下取整")}</b>{t("(少送即多赚)。年付默认 = 月费×12、无额外折扣,想给年付优惠就调低该档倍率或年费。")}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
