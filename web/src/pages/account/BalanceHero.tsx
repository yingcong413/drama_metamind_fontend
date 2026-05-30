import { PlusIcon } from "@/components/icons";
import { formatDateTime, formatYuanInt } from "@/lib/format";
import { useAuthStore } from "@/stores/auth";
import type { Account } from "@/types";

interface Props {
  account: Account;
  onRecharge: () => void;
}

const fmtSeconds = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};

export function BalanceHero({ account, onRecharge }: Props) {
  // PRD v0.9 §1.5.3:Member 看到简化版余额视图,无充值入口
  const user = useAuthStore((s) => s.user);
  const isMember = user?.role === "member";
  const orgName = user?.org?.name;

  return (
    <section className="acc-hero">
      <div className="acc-hero-main">
        <div
          className="dim-2 mono"
          style={{
            fontSize: 11, letterSpacing: ".1em",
            textTransform: "uppercase", marginBottom: 14,
          }}
        >
          {isMember ? "组织可用余额 · ORG BALANCE" : "账户余额 · BALANCE"}
        </div>
        <div className="acc-balance">
          <span className="acc-balance-currency">¥</span>
          <span className="acc-balance-num mono">{formatYuanInt(account.balance_cents)}</span>
          <span className="acc-balance-unit">.00</span>
        </div>
        <div className="acc-balance-breakdown">
          <span className="dim-2">
            {isMember ? "由 Owner 充值,本组织所有成员共享" : "按视频实际消耗扣费,余额不过期"}
          </span>
          {!isMember && account.last_recharge && (
            <>
              <span style={{ color: "var(--border-strong)" }}>·</span>
              <span className="dim-2">
                最近充值{" "}
                <span className="mono" style={{ color: "var(--text)" }}>
                  ¥{formatYuanInt(account.last_recharge.amount_cents)}
                </span>{" "}
                · {formatDateTime(account.last_recharge.time).slice(5, 10)}
              </span>
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          {isMember ? (
            <div
              style={{
                padding: "12px 16px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 13,
                color: "var(--text-secondary)",
                maxWidth: 480,
              }}
            >
              本组织{orgName ? `「${orgName}」` : ""}余额不足时,请联系 Owner 充值。
            </div>
          ) : (
            <>
              <button className="btn btn-primary btn-lg" onClick={onRecharge}>
                <PlusIcon /> 立即充值
              </button>
              <button className="btn btn-lg">查看发票</button>
              <button className="btn btn-lg">企业开票</button>
            </>
          )}
        </div>
      </div>

      <div className="acc-hero-stats">
        <div className="acc-stat">
          <div className="acc-stat-label mono">本月消费</div>
          <div className="acc-stat-value">
            <span className="cur">¥</span>
            <span className="mono">{formatYuanInt(account.this_month.spent_cents)}</span>
          </div>
          <div className="acc-stat-foot mono dim-2">较上月 ↓ 12%</div>
        </div>
        <div className="acc-stat">
          <div className="acc-stat-label mono">本月生成</div>
          <div className="acc-stat-value">
            <span className="mono">{account.this_month.generated_count}</span>
            <span className="cur" style={{ marginLeft: 4 }}>条</span>
          </div>
          <div className="acc-stat-foot mono dim-2">
            合计 {fmtSeconds(account.this_month.duration_seconds)} 时长
          </div>
        </div>
        <div className="acc-stat">
          <div className="acc-stat-label mono">累计充值</div>
          <div className="acc-stat-value">
            <span className="cur">¥</span>
            <span className="mono">{formatYuanInt(account.lifetime.recharged_cents)}</span>
          </div>
          <div className="acc-stat-foot mono dim-2">
            累计消费 ¥{formatYuanInt(account.lifetime.spent_cents)}
          </div>
        </div>
      </div>
    </section>
  );
}
