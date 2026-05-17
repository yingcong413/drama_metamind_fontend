import { useState } from "react";
import { CloseIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { formatYuanInt } from "@/lib/format";
import type { Account, RechargeMethod } from "@/types";

interface Props {
  account: Account;
  onClose: () => void;
}

const PRESETS = [10000, 50000, 100000, 500000]; // cents

export function RechargeDialog({ account, onClose }: Props) {
  const [amountCents, setAmountCents] = useState(50000);
  const [method, setMethod] = useState<RechargeMethod>("wechat");
  const yuan = Math.floor(amountCents / 100);
  const valid = amountCents >= 5000 && (method !== "bank" || amountCents >= 500000);

  return (
    <>
      <div className="drawer-mask" onClick={onClose} />
      <div className="recharge-dialog">
        <div className="recharge-head">
          <div>
            <h2>账户充值</h2>
            <div className="dim" style={{ fontSize: 13 }}>
              当前余额{" "}
              <span className="mono" style={{ color: "var(--text)" }}>
                ¥ {formatYuanInt(account.balance_cents)}
              </span>{" "}
              · 充值后立即到账
            </div>
          </div>
          <button className="btn-ghost btn-icon" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="recharge-body">
          <div
            className="dim-2 mono"
            style={{
              fontSize: 11, letterSpacing: ".06em",
              textTransform: "uppercase", marginBottom: 10,
            }}
          >
            充值金额
          </div>
          <div className="recharge-amount-row">
            {PRESETS.map((p) => (
              <button
                key={p}
                className={cn("recharge-preset", amountCents === p && "selected")}
                onClick={() => setAmountCents(p)}
              >
                <span className="cur">¥</span>
                <span className="mono">{formatYuanInt(p)}</span>
              </button>
            ))}
          </div>

          <div
            className="dim-2 mono"
            style={{
              fontSize: 11, letterSpacing: ".06em",
              textTransform: "uppercase", margin: "18px 0 10px",
            }}
          >
            或自定义金额
          </div>
          <div className="phone-input" style={{ maxWidth: 360 }}>
            <span className="phone-cc" style={{ cursor: "default" }}>¥</span>
            <input
              className="input input-lg"
              style={{ border: "none" }}
              placeholder="50 - 50000"
              value={yuan || ""}
              onChange={(e) => setAmountCents(Number(e.target.value.replace(/\D/g, "")) * 100)}
              inputMode="numeric"
            />
          </div>
          <div className="dim-2" style={{ fontSize: 11, marginTop: 6 }}>
            充值金额即为账户余额，按视频实际消耗扣费，余额不过期
          </div>

          <div
            className="dim-2 mono"
            style={{
              fontSize: 11, letterSpacing: ".06em",
              textTransform: "uppercase", margin: "22px 0 10px",
            }}
          >
            支付方式
          </div>
          <div className="recharge-method-grid">
            <button
              className={cn("recharge-method", method === "wechat" && "selected")}
              onClick={() => setMethod("wechat")}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="oklch(70% .14 150)">
                <path d="M8.5 4C4.36 4 1 6.69 1 10c0 1.89 1.1 3.57 2.82 4.66L3 17.5l3.04-1.66c.78.21 1.6.33 2.46.33.13 0 .26 0 .39-.01-.25-.65-.39-1.36-.39-2.1 0-3.31 3.36-6 7.5-6 .35 0 .69.03 1.03.08C16.21 5.31 12.7 4 8.5 4zm-2.5 4.5a1 1 0 110 2 1 1 0 010-2zm5 0a1 1 0 110 2 1 1 0 010-2zm5.5 4c-3.59 0-6.5 2.24-6.5 5 0 1.51.86 2.86 2.24 3.79L11.5 23l2.45-1.43c.66.17 1.36.27 2.05.27 3.59 0 6.5-2.24 6.5-5s-2.91-5-6.5-5z" />
              </svg>
              <span>微信支付</span>
              <span className="dim-2 mono" style={{ fontSize: 10 }}>WeChat Pay</span>
            </button>
            <button
              className={cn("recharge-method", method === "alipay" && "selected")}
              onClick={() => setMethod("alipay")}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="oklch(65% .14 230)">
                <path d="M5 3h14a2 2 0 012 2v9.2c-2.4-.5-5.1-1.6-7.7-2.9.6-1.2 1.1-2.5 1.4-3.7H10v-1.7h4.3v-1H10V3.8h2.1V3H10c-.6 0-1 .4-1 1v1h-3.4v1h3.4v1.7H5.9V9h6.4c-.2.8-.5 1.6-.9 2.4-2.5-1-3.9-1.5-5.4-1.5-3.1 0-3.9 2.5-3.4 4.4.4 1.4 1.6 2.6 4.1 2.6 1.7 0 3.9-.9 5.6-2.7 2.4 1.4 6.3 3 8.7 3.4V19a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm.5 8.8c-1.3 0-2.6.7-2.5 2 .1.9.9 1.6 2.3 1.6 1.4 0 3.1-.6 4.8-2.2-1.4-.8-3.2-1.4-4.6-1.4z" />
              </svg>
              <span>支付宝</span>
              <span className="dim-2 mono" style={{ fontSize: 10 }}>Alipay</span>
            </button>
            <button
              className={cn("recharge-method", method === "bank" && "selected")}
              onClick={() => setMethod("bank")}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M2 10L12 4l10 6M4 10v9m4-9v9m4-9v9m4-9v9m4-9v9M2 21h20" />
              </svg>
              <span>对公转账</span>
              <span className="dim-2 mono" style={{ fontSize: 10 }}>≥ ¥ 5,000</span>
            </button>
          </div>
        </div>

        <div className="recharge-foot">
          <div className="recharge-summary">
            <div>
              <div className="dim-2 mono" style={{ fontSize: 11 }}>本次充值</div>
              <div className="recharge-summary-amount">
                <span className="cur">¥</span>
                <span className="mono">{formatYuanInt(amountCents)}</span>
              </div>
            </div>
            <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 24 }}>
              <div className="dim-2 mono" style={{ fontSize: 11 }}>充值后余额</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                <span className="dim-2" style={{ fontSize: 12, marginRight: 2 }}>¥</span>
                <span className="mono">
                  {formatYuanInt(account.balance_cents + amountCents)}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-lg" onClick={onClose}>取消</button>
            <button
              className="btn btn-primary btn-lg"
              onClick={onClose}
              disabled={!valid}
            >
              确认支付 ¥{formatYuanInt(amountCents)}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
