import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { CoinIcon, CheckIcon, CloseIcon, SearchIcon } from "@/components/icons";
import { useIsPlatformAdmin } from "@/stores/auth";
import { useT } from "@/lib/i18n";

const UNIT_PRICE_PER_1K = 0.018;
const CREDIT_TO_CNY = 0.1;

const TYPE_COLOR: Record<string, string> = {
  常规: "oklch(70% .13 230)",
  首尾帧: "oklch(76% .13 70)",
  智能多帧: "oklch(76% .13 150)",
};

interface Master {
  name: string;
  ent: boolean;
  c: string;
  subs: string[];
}

const MASTERS: Master[] = [
  { name: "星河传媒", ent: true, c: "oklch(62% .14 20)", subs: ["王磊", "李娜", "陈昊", "张敏"] },
  { name: "微光工作室", ent: true, c: "oklch(64% .13 160)", subs: ["周野", "吴桐", "郑爽"] },
  { name: "林晚（个人）", ent: false, c: "oklch(64% .13 280)", subs: ["林晚"] },
  { name: "赵清（个人）", ent: false, c: "oklch(66% .12 320)", subs: ["赵清"] },
];

interface UsageRow {
  time: string;
  master: Master;
  sub: string;
  type: string;
  res: string;
  task: string;
  ok: boolean;
  cost: number;
  tokens: number;
}

function buildData(): UsageRow[] {
  const types = Object.keys(TYPE_COLOR);
  const rows: UsageRow[] = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 60; i++) {
    const m = MASTERS[Math.floor(rnd() * MASTERS.length)];
    const sub = m.subs[Math.floor(rnd() * m.subs.length)];
    const type = types[Math.floor(rnd() * 3)];
    const day = 17 - Math.floor(rnd() * 16);
    const hh = Math.floor(rnd() * 24);
    const mm = Math.floor(rnd() * 60);
    const ok = rnd() > 0.12;
    rows.push({
      time: `2026-05-${String(day).padStart(2, "0")} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
      master: m,
      sub,
      type,
      res: rnd() > 0.5 ? "1080P" : "720P",
      task: `task_${(rnd() * 1e9).toString(36).slice(0, 8)}`,
      ok,
      cost: ok ? Math.floor(180 + rnd() * 620) : 0,
      tokens: ok ? Math.floor(60000 + rnd() * 340000) : 0,
    });
  }
  rows.sort((a, b) => (a.time < b.time ? 1 : -1));
  return rows;
}

const fmtY = (n: number) =>
  "¥" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function AdminUsagePage() {
  const isAdmin = useIsPlatformAdmin();
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <UsageBody />;
}

function UsageBody() {
  const t = useT();
  const data = useMemo(buildData, []);

  const [fMaster, setFMaster] = useState("");
  const [fSub, setFSub] = useState("");
  const [fTask, setFTask] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fRes, setFRes] = useState("");
  const [fType, setFType] = useState("");
  const [fCost, setFCost] = useState("");
  const [from, setFrom] = useState("2026-05-01 00:00:00");
  const [to, setTo] = useState("2026-05-17 23:59:59");

  const subOptions = fMaster
    ? MASTERS.find((m) => m.name === fMaster)?.subs ?? []
    : [...new Set(MASTERS.flatMap((m) => m.subs))];

  const inCost = (v: number) => {
    if (!fCost) return true;
    if (fCost.includes("<")) return v < 300;
    if (fCost.includes(">")) return v > 600;
    return v >= 300 && v <= 600;
  };

  const rows = data.filter(
    (d) =>
      (!fMaster || d.master.name === fMaster) &&
      (!fSub || d.sub === fSub) &&
      (!fTask || d.task.includes(fTask)) &&
      (!fStatus || (fStatus === "成功") === d.ok) &&
      (!fRes || d.res === fRes) &&
      (!fType || d.type === fType) &&
      inCost(d.cost),
  );

  const totalCredit = rows.reduce((s, d) => s + (d.ok ? d.cost : 0), 0);
  const totalCny = totalCredit * CREDIT_TO_CNY;
  const activeSubs = new Set(rows.map((d) => d.sub)).size;

  const reset = () => {
    setFMaster("");
    setFSub("");
    setFTask("");
    setFStatus("");
    setFRes("");
    setFType("");
    setFCost("");
  };

  return (
    <>
      <AppTopBar crumbs={[{ label: t("平台管理") }, { label: t("所有消耗") }]} />
      <div className="adm-usage">
        <div className="adm-head">
          <div>
            <div className="eyebrow">ADMIN · {t("平台管理")}</div>
            <h1 className="adm-h1">{t("所有消耗")}</h1>
            <div className="adm-sub">
              {t("平台下所有账户的积分消耗记录，可定位每一条消耗所属的主账号与子账号。")}
            </div>
            <div className="ent-banner">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {t("平台管理员视图 · 可见全平台所有用户消耗")}
            </div>
          </div>
          <div className="adm-stats">
            <div className="adm-stat">
              <div className="as-lbl">{t("消耗")}</div>
              <div className="as-num"><CoinIcon /> {totalCredit.toLocaleString()}</div>
            </div>
            <div className="adm-stat">
              <div className="as-lbl">{t("金额")}</div>
              <div className="as-num">{fmtY(totalCny)}</div>
            </div>
            <div className="adm-stat">
              <div className="as-lbl">{t("活跃子账号")}</div>
              <div className="as-num">{activeSubs}</div>
            </div>
          </div>
        </div>

        <div className="filter-card">
          <div className="filter-grid">
            <div className="fl-date">
              <div className="fl-lbl">{t("时间")}</div>
              <div className="date-stack">
                <input className="input mono" value={from} onChange={(e) => setFrom(e.target.value)} />
                <span className="date-tilde">~</span>
                <input className="input mono" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            <div className="fl-acct">
              <div className="fl-lbl">{t("主账号")} <span className="adm-tag">ADMIN</span></div>
              <select
                className="select"
                value={fMaster}
                onChange={(e) => {
                  setFMaster(e.target.value);
                  setFSub("");
                }}
              >
                <option value="">{t("全部主账号")}</option>
                {MASTERS.map((m) => (
                  <option key={m.name} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="fl-acct">
              <div className="fl-lbl">{t("子账号")}</div>
              <select className="select" value={fSub} onChange={(e) => setFSub(e.target.value)}>
                <option value="">{t("全部子账号")}</option>
                {subOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="fl-task">
              <div className="fl-lbl">{t("任务 ID")}</div>
              <div className="input-search">
                <span className="ico"><SearchIcon /></span>
                <input className="input mono" placeholder="task_..." value={fTask} onChange={(e) => setFTask(e.target.value)} />
              </div>
            </div>
            <div className="fl-sel">
              <div className="fl-lbl">{t("状态")}</div>
              <select className="select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option value="">{t("全部")}</option>
                <option value="成功">{t("成功")}</option>
                <option value="失败">{t("失败")}</option>
              </select>
            </div>
            <div className="fl-sel">
              <div className="fl-lbl">{t("清晰度")}</div>
              <select className="select" value={fRes} onChange={(e) => setFRes(e.target.value)}>
                <option value="">{t("全部")}</option>
                <option value="720P">720P</option>
                <option value="1080P">1080P</option>
              </select>
            </div>
            <div className="fl-sel">
              <div className="fl-lbl">{t("生成类型")}</div>
              <select className="select" value={fType} onChange={(e) => setFType(e.target.value)}>
                <option value="">{t("全部")}</option>
                <option value="常规">{t("常规")}</option>
                <option value="首尾帧">{t("首尾帧")}</option>
                <option value="智能多帧">{t("智能多帧")}</option>
              </select>
            </div>
            <div className="fl-sel">
              <div className="fl-lbl">{t("消耗区间")}</div>
              <select className="select" value={fCost} onChange={(e) => setFCost(e.target.value)}>
                <option value="">{t("不限")}</option>
                <option value="<300">&lt; 300</option>
                <option value="300-600">300 - 600</option>
                <option value=">600">&gt; 600</option>
              </select>
            </div>
          </div>
          <div className="filter-foot">
            <div className="result-count">
              {t("共")} <b>{rows.length}</b> {t("条消耗记录")}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn" onClick={reset}>{t("重置")}</button>
              <button className="btn">{t("导出 CSV")}</button>
            </div>
          </div>
        </div>

        <div className="ratio-legend">
          <span className="rl-item"><span className="rl-dot" />{t("官方单价")} <b>¥0.018 / 1K token</b></span>
          <span className="rl-item"><span className="rl-dot" />{t("总成本 = 消耗 token × 官方单价")}</span>
          <span className="rl-item"><span className="rl-dot" />1 Credit = <b>¥0.10</b></span>
        </div>

        <div className="table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>{t("时间")}</th>
                <th>{t("主账号")}</th>
                <th>{t("子账号")}</th>
                <th>{t("类型")}</th>
                <th>{t("清晰度")}</th>
                <th>{t("任务 ID")}</th>
                <th>{t("状态")}</th>
                <th>{t("消耗 token")}<br /><span className="th-unit">（{t("千 token")}）</span></th>
                <th>{t("官方单价")}<br /><span className="th-unit">（{t("元/千 token")}）</span></th>
                <th>{t("总成本")}</th>
                <th>{t("消耗 Credit")}</th>
                <th>{t("消耗金额")}</th>
                <th>{t("详情")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d, i) => (
                <tr key={i}>
                  <td className="mono">{d.time}</td>
                  <td>
                    <span className="acct-cell">
                      <span className="acct-ava" style={{ background: d.master.c }}>{d.master.name[0]}</span>
                      {d.master.name.replace("（个人）", "")}
                      {d.master.ent && <span className="ent-pill">{t("企业")}</span>}
                    </span>
                  </td>
                  <td>{d.sub}</td>
                  <td>
                    <span
                      className="tag-type"
                      style={{ color: TYPE_COLOR[d.type], background: TYPE_COLOR[d.type].replace(")", " / .14)") }}
                    >
                      {t(d.type)}
                    </span>
                  </td>
                  <td className="mono">{d.res}</td>
                  <td className="mono faint">{d.task}</td>
                  <td>
                    <span className={"chip-status " + (d.ok ? "ok" : "fail")}>
                      {d.ok ? <CheckIcon /> : <CloseIcon />} {d.ok ? t("成功") : t("失败")}
                    </span>
                  </td>
                  <td className="mono">
                    {d.ok ? (d.tokens / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : <span className="faint">—</span>}
                  </td>
                  <td className="mono faint">{UNIT_PRICE_PER_1K.toFixed(3)}</td>
                  <td className="mono">{d.ok ? fmtY((d.tokens / 1000) * UNIT_PRICE_PER_1K) : <span className="faint">—</span>}</td>
                  <td>
                    {d.ok ? (
                      <span className="cost-credit"><CoinIcon /> {d.cost.toLocaleString()}</span>
                    ) : (
                      <span className="faint mono">—</span>
                    )}
                  </td>
                  <td className="mono">{d.ok ? fmtY(d.cost * CREDIT_TO_CNY) : <span className="faint">—</span>}</td>
                  <td><button className="btn-link btn-sm">{t("查看")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
