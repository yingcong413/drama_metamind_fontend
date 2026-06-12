import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Avatar } from "@/components/primitives/Avatar";
import { CloseIcon, CoinIcon, ArrowRightIcon } from "@/components/icons";
import { PayMethodModal } from "./PayMethodModal";
import { formatYuanInt } from "@/lib/format";
import { useT, useTf } from "@/lib/i18n";
import { useAuthStore } from "@/stores/auth";
import {
  createRechargeOrder,
  getRechargeOrder,
  mockPayOrder,
  type CreateOrderResp,
  type PayMethod,
} from "@/api/recharge";
import type { Account } from "@/types";

interface Props {
  account: Account;
  onClose: () => void;
}

interface Pack {
  credits: string;
  orig?: string;
  priceCents: number;
  wide?: boolean;
  bonus?: string;
}

const PACKS: Pack[] = [
  { credits: "490", priceCents: 4900 },
  { credits: "1,400", priceCents: 14000 },
  { credits: "2,100", priceCents: 21000 },
  { credits: "3,500", priceCents: 35000 },
  { credits: "7,000", priceCents: 70000 },
  { credits: "14,000", priceCents: 140000 },
  { credits: "84,000", orig: "70,000", priceCents: 700000, wide: true },
];

export function RechargeDialog({ account, onClose }: Props) {
  const t = useT();
  const tf = useTf();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [packId, setPackId] = useState(0);
  const [showPay, setShowPay] = useState(false);
  const [methodLabel, setMethodLabel] = useState("");
  const [phase, setPhase] = useState<"select" | "paying" | "done">("select");
  const [order, setOrder] = useState<CreateOrderResp | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<number | null>(null);

  const amountCents = PACKS[packId].priceCents;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

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
    window.setTimeout(onClose, 1200);
  };

  const startPay = async (pm: PayMethod, label: string) => {
    setShowPay(false);
    setMethodLabel(label);
    setBusy(true);
    setErr(null);
    try {
      const o = await createRechargeOrder({ amount_cents: amountCents, method: pm });
      setOrder(o);
      setPhase("paying");
      if (o.pay_url && !o.qr_code) {
        window.open(o.pay_url, "_blank", "noopener");
      }
      pollRef.current = window.setInterval(async () => {
        try {
          const s = await getRechargeOrder(o.recharge_id);
          if (s.status === "success") onPaid();
          else if (s.status === "failed") {
            stopPoll();
            setErr(t("支付失败，请重试"));
          }
        } catch {
          /* 轮询错误忽略 */
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
      <div className="rc-mask" onClick={onClose}>
        <div className="recharge-modal" onClick={(e) => e.stopPropagation()}>
          <div className="rc-head">
            <h3 className="rc-title">{t("积分充值")}</h3>
            <button className="rc-close" onClick={onClose}><CloseIcon /></button>
          </div>

          <div className="rc-user">
            <Avatar name={user?.name ?? "你"} size="lg" />
            <div className="rc-user-info">
              <div className="rc-user-name">{user?.name ?? t("未命名")}</div>
              <div className="rc-user-plan">
                {t("当前为")} <span className="rc-plan-badge">FREE</span> Studio
                <button className="rc-upgrade">{t("升级")}<ArrowRightIcon /></button>
              </div>
            </div>
            <div className="rc-user-bal">
              <span className="rc-bal-lbl">{t("积分")}</span>
              <span className="rc-bal-coin"><CoinIcon /></span>
              <span className="rc-bal-num">{Math.round(account.balance_cents / 100).toLocaleString()}</span>
            </div>
          </div>

          {phase === "select" && (
            <>
              <div className="rc-grid">
                {PACKS.map((p, i) => (
                  <button
                    key={i}
                    className={
                      "rc-pack" + (p.wide ? " rc-pack-wide" : "") + (packId === i ? " selected" : "")
                    }
                    onClick={() => setPackId(i)}
                  >
                    {p.wide && (
                      <span className="rc-pack-badge">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                        </svg>
                        {t("会员额外赠送 20%")}
                      </span>
                    )}
                    <div className="rc-pack-main">
                      <span className="rc-pack-coin"><CoinIcon /></span>
                      <span className="rc-pack-credits">
                        {p.orig && <s>{p.orig}</s>}{p.credits}
                      </span>
                    </div>
                    <div className="rc-pack-price">¥ {(p.priceCents / 100).toLocaleString()}</div>
                  </button>
                ))}
              </div>

              <p className="rc-note">
                {t("提示：快速生成、去水印等会员权益仅在订阅后可用，单独购买积分不会解锁这些功能。购买的积分有效期 1 年，赠送积分有效期 31 天。")}
                {t("客服联系：")}<a href="#">payment@zhiying.ai</a>　<a href="#">{t("积分规则")}</a>
              </p>

              <button className="rc-buy" onClick={() => setShowPay(true)} disabled={busy}>
                {busy ? t("下单中…") : t("购买积分")}
              </button>
              {err && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 12, textAlign: "center" }}>{err}</div>}
            </>
          )}

          {phase === "paying" && order && order.pay_url && !order.qr_code && (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontSize: 14, marginBottom: 4 }}>
                {tf("已在新标签打开 Stripe 支付页，完成 ${usd} 信用卡支付", { usd: ((order.usd_cents ?? 0) / 100).toFixed(2) })}
              </div>
              <div className="dim-2" style={{ fontSize: 12, marginBottom: 12 }}>
                {tf("到账 ≈ ¥{amt}", { amt: formatYuanInt(order.amount_cents) })}
              </div>
              <button className="btn btn-primary btn-lg" style={{ marginBottom: 12 }} onClick={() => window.open(order.pay_url!, "_blank", "noopener")}>
                {t("重新打开支付页")}
              </button>
              <div className="dim-2" style={{ fontSize: 12 }}>
                {t("支付完成后自动到账，本窗口会自动刷新…（如未弹出请检查浏览器拦截）")}
              </div>
              {err && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 12 }}>{err}</div>}
            </div>
          )}

          {phase === "paying" && order && !(order.pay_url && !order.qr_code) && (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontSize: 14, marginBottom: 12 }}>
                {tf("请用 {method} 扫码支付 ¥{amt}", { method: methodLabel, amt: formatYuanInt(order.amount_cents) })}
              </div>
              <div style={{ width: 224, height: 224, margin: "0 auto", border: "1px solid var(--border)", borderRadius: 12, display: "grid", placeItems: "center", padding: 12, background: "#fff" }}>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt={t("支付二维码")} width={200} height={200} style={{ display: "block" }} />
                ) : (
                  <div className="mono" style={{ fontSize: 10, wordBreak: "break-all", color: "#666" }}>{order.qr_code}</div>
                )}
              </div>
              <div className="dim-2" style={{ fontSize: 12, marginTop: 12 }}>{t("支付完成后自动到账，本窗口会自动刷新…")}</div>
              {order.is_stub && (
                <button className="btn btn-primary btn-lg" style={{ marginTop: 16 }} onClick={doMockPay} disabled={busy}>
                  {busy ? t("处理中…") : t("模拟支付成功（dev）")}
                </button>
              )}
              {err && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 12 }}>{err}</div>}
            </div>
          )}

          {phase === "done" && (
            <div style={{ textAlign: "center", padding: "40px 24px" }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "oklch(72% .16 150)" }}>{t("充值成功 ✓")}</div>
              <div className="dim-2" style={{ fontSize: 13, marginTop: 8 }}>{t("积分已到账")}</div>
            </div>
          )}
        </div>
      </div>

      {showPay && (
        <PayMethodModal onClose={() => setShowPay(false)} onPick={startPay} />
      )}
    </>
  );
}
