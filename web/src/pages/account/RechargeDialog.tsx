import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { CloseIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { formatYuanInt } from "@/lib/format";
import {
  createRechargeOrder,
  getRechargeOrder,
  mockPayOrder,
  type CreateOrderResp,
  type PayMethod,
} from "@/api/recharge";
import type { Account, RechargeMethod } from "@/types";

interface Props {
  account: Account;
  onClose: () => void;
}

const PRESETS = [10000, 50000, 100000, 500000]; // cents

// 前端 method → 后端 method
function toPayMethod(m: RechargeMethod): PayMethod | null {
  if (m === "wechat") return "wechat_pay";
  if (m === "alipay") return "alipay";
  return null; // bank 不走自助
}

export function RechargeDialog({ account, onClose }: Props) {
  const qc = useQueryClient();
  const [amountCents, setAmountCents] = useState(50000);
  const [method, setMethod] = useState<RechargeMethod>("wechat");
  const [phase, setPhase] = useState<"select" | "paying" | "done">("select");
  const [order, setOrder] = useState<CreateOrderResp | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<number | null>(null);

  // 把支付串渲染成真实二维码图片
  useEffect(() => {
    if (phase !== "paying" || !order?.qr_code) {
      setQrDataUrl(null);
      return;
    }
    let alive = true;
    QRCode.toDataURL(order.qr_code, { width: 200, margin: 1 })
      .then((url) => { if (alive) setQrDataUrl(url); })
      .catch(() => { if (alive) setQrDataUrl(null); });
    return () => { alive = false; };
  }, [phase, order?.qr_code]);

  const yuan = Math.floor(amountCents / 100);
  const valid = amountCents >= 100 && (method === "wechat" || method === "alipay");

  const stopPoll = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };
  useEffect(() => () => stopPoll(), []);

  const onPaid = () => {
    stopPoll();
    setPhase("done");
    qc.invalidateQueries({ queryKey: ["account"] });
    qc.invalidateQueries({ queryKey: ["recharges"] });
    // 1.2s 后自动关闭
    window.setTimeout(onClose, 1200);
  };

  const startPay = async () => {
    const pm = toPayMethod(method);
    if (!pm) return;
    setBusy(true);
    setErr(null);
    try {
      const o = await createRechargeOrder({ amount_cents: amountCents, method: pm });
      setOrder(o);
      setPhase("paying");
      // 轮询订单状态
      pollRef.current = window.setInterval(async () => {
        try {
          const s = await getRechargeOrder(o.recharge_id);
          if (s.status === "success") onPaid();
          else if (s.status === "failed") {
            stopPoll();
            setErr("支付失败，请重试");
          }
        } catch {
          /* 轮询错误忽略，下次再试 */
        }
      }, 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doMockPay = async () => {
    if (!order) return;
    setBusy(true);
    try {
      await mockPayOrder(order.recharge_id);
      onPaid();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

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
              · 扫码支付到账
            </div>
          </div>
          <button className="btn-ghost btn-icon" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        {phase === "select" && (
          <div className="recharge-body">
            <div className="dim-2 mono" style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 10 }}>
              充值金额
            </div>
            <div className="recharge-amount-row">
              {PRESETS.map((p) => (
                <button key={p} className={cn("recharge-preset", amountCents === p && "selected")} onClick={() => setAmountCents(p)}>
                  <span className="cur">¥</span>
                  <span className="mono">{formatYuanInt(p)}</span>
                </button>
              ))}
            </div>

            <div className="dim-2 mono" style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", margin: "18px 0 10px" }}>
              或自定义金额
            </div>
            <div className="phone-input" style={{ maxWidth: 360 }}>
              <span className="phone-cc" style={{ cursor: "default" }}>¥</span>
              <input
                className="input input-lg"
                style={{ border: "none" }}
                placeholder="1 - 1000000"
                value={yuan || ""}
                onChange={(e) => setAmountCents(Number(e.target.value.replace(/\D/g, "")) * 100)}
                inputMode="numeric"
              />
            </div>
            <div className="dim-2" style={{ fontSize: 11, marginTop: 6 }}>
              充值金额即为账户余额，按视频实际消耗扣费，余额不过期
            </div>

            <div className="dim-2 mono" style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", margin: "22px 0 10px" }}>
              支付方式
            </div>
            <div className="recharge-method-grid">
              <button className={cn("recharge-method", method === "wechat" && "selected")} onClick={() => setMethod("wechat")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="oklch(70% .14 150)">
                  <path d="M8.5 4C4.36 4 1 6.69 1 10c0 1.89 1.1 3.57 2.82 4.66L3 17.5l3.04-1.66c.78.21 1.6.33 2.46.33.13 0 .26 0 .39-.01-.25-.65-.39-1.36-.39-2.1 0-3.31 3.36-6 7.5-6 .35 0 .69.03 1.03.08C16.21 5.31 12.7 4 8.5 4zm-2.5 4.5a1 1 0 110 2 1 1 0 010-2zm5 0a1 1 0 110 2 1 1 0 010-2zm5.5 4c-3.59 0-6.5 2.24-6.5 5 0 1.51.86 2.86 2.24 3.79L11.5 23l2.45-1.43c.66.17 1.36.27 2.05.27 3.59 0 6.5-2.24 6.5-5s-2.91-5-6.5-5z" />
                </svg>
                <span>微信支付</span>
                <span className="dim-2 mono" style={{ fontSize: 10 }}>WeChat Pay</span>
              </button>
              <button className={cn("recharge-method", method === "alipay" && "selected")} onClick={() => setMethod("alipay")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="oklch(65% .14 230)">
                  <path d="M5 3h14a2 2 0 012 2v9.2c-2.4-.5-5.1-1.6-7.7-2.9.6-1.2 1.1-2.5 1.4-3.7H10v-1.7h4.3v-1H10V3.8h2.1V3H10c-.6 0-1 .4-1 1v1h-3.4v1h3.4v1.7H5.9V9h6.4c-.2.8-.5 1.6-.9 2.4-2.5-1-3.9-1.5-5.4-1.5-3.1 0-3.9 2.5-3.4 4.4.4 1.4 1.6 2.6 4.1 2.6 1.7 0 3.9-.9 5.6-2.7 2.4 1.4 6.3 3 8.7 3.4V19a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm.5 8.8c-1.3 0-2.6.7-2.5 2 .1.9.9 1.6 2.3 1.6 1.4 0 3.1-.6 4.8-2.2-1.4-.8-3.2-1.4-4.6-1.4z" />
                </svg>
                <span>支付宝</span>
                <span className="dim-2 mono" style={{ fontSize: 10 }}>Alipay</span>
              </button>
              <button className={cn("recharge-method", method === "bank" && "selected")} onClick={() => setMethod("bank")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M2 10L12 4l10 6M4 10v9m4-9v9m4-9v9m4-9v9m4-9v9M2 21h20" />
                </svg>
                <span>对公转账</span>
                <span className="dim-2 mono" style={{ fontSize: 10 }}>联系商务</span>
              </button>
            </div>

            {method === "bank" && (
              <div className="dim-2" style={{ fontSize: 12, marginTop: 12, color: "oklch(78% .12 70)" }}>
                对公转账请联系商务，由平台管理员后台手动充值到账。
              </div>
            )}
            {err && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 12 }}>{err}</div>}
          </div>
        )}

        {phase === "paying" && order && (
          <div className="recharge-body" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, marginBottom: 12 }}>
              请用{method === "wechat" ? "微信" : "支付宝"}扫码支付 ¥{formatYuanInt(order.amount_cents)}
            </div>
            <div
              style={{
                width: 224, height: 224, margin: "0 auto",
                border: "1px solid var(--border)", borderRadius: 12,
                display: "grid", placeItems: "center", padding: 12,
                background: "#fff",
              }}
            >
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="支付二维码" width={200} height={200} style={{ display: "block" }} />
              ) : (
                <div className="mono" style={{ fontSize: 10, wordBreak: "break-all", color: "#666" }}>
                  {order.qr_code}
                </div>
              )}
            </div>
            <div className="dim-2" style={{ fontSize: 12, marginTop: 12 }}>
              支付完成后自动到账，本窗口会自动刷新…
            </div>
            {order.is_stub && (
              <button className="btn btn-primary btn-lg" style={{ marginTop: 16 }} onClick={doMockPay} disabled={busy}>
                {busy ? "处理中…" : "模拟支付成功（dev）"}
              </button>
            )}
            {err && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 12 }}>{err}</div>}
          </div>
        )}

        {phase === "done" && (
          <div className="recharge-body" style={{ textAlign: "center", padding: "40px 24px" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "oklch(72% .16 150)" }}>充值成功 ✓</div>
            <div className="dim-2" style={{ fontSize: 13, marginTop: 8 }}>余额已到账</div>
          </div>
        )}

        {phase === "select" && (
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
                  <span className="mono">{formatYuanInt(account.balance_cents + amountCents)}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-lg" onClick={onClose}>取消</button>
              <button className="btn btn-primary btn-lg" onClick={startPay} disabled={!valid || busy}>
                {busy ? "下单中…" : `去支付 ¥${formatYuanInt(amountCents)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
