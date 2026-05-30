import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";

interface QrData {
  state: string;
  qrcode_url: string;
  expires_in: number;
  mock?: boolean;
}

interface PollResult {
  status: "pending" | "success";
  token?: string;
  expires_at?: string;
}

interface Props {
  onClose: () => void;
  /** 拿到 token 后回调:父组件用 token 拉 /auth/me 写 authStore + navigate */
  onSuccess: (token: string) => void;
}

export function WechatQrModal({ onClose, onSuccess }: Props) {
  const [qr, setQr] = useState<QrData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  // 1. 获取二维码
  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/auth/wechat/qrcode")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
        return r.json() as Promise<QrData>;
      })
      .then((data) => {
        if (cancelled) return;
        setQr(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. 拿到 state 后开始轮询
  useEffect(() => {
    if (!qr?.state) return;
    pollRef.current = window.setInterval(async () => {
      try {
        const r = await fetch(`/api/v1/auth/wechat/poll?state=${encodeURIComponent(qr.state)}`);
        if (!r.ok) return;
        const data = (await r.json()) as PollResult;
        if (data.status === "success" && data.token) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          onSuccess(data.token);
        }
      } catch {
        /* 网络抖动忽略,下次轮询继续 */
      }
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [qr?.state, onSuccess]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1200,
        background: "rgba(0,0,0,.55)",
        display: "grid", placeItems: "center",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 320,
          padding: 24,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,.5)",
          position: "relative",
          textAlign: "center",
        }}
      >
        <button
          className="btn-ghost btn-icon"
          onClick={onClose}
          title="关闭"
          style={{ position: "absolute", top: 10, right: 10 }}
        >
          <CloseIcon />
        </button>
        <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 600 }}>微信扫码登录</h3>
        <p className="dim-2" style={{ fontSize: 12, marginBottom: 18 }}>
          请使用微信扫描下方二维码授权
        </p>
        {error ? (
          <div style={{ color: "oklch(72% .15 25)", fontSize: 13, padding: "20px 0" }}>
            加载失败:{error}
          </div>
        ) : !qr ? (
          <div className="dim-2" style={{ padding: "60px 0" }}>正在生成二维码…</div>
        ) : (
          <>
            <img
              src={qr.qrcode_url}
              alt="微信扫码登录"
              style={{ width: 220, height: 220, borderRadius: 8, background: "#fff", padding: 8 }}
            />
            {qr.mock && (
              <div className="dim-2" style={{ fontSize: 11, marginTop: 12, lineHeight: 1.6 }}>
                ⓘ 当前是 mock 模式,2 秒后自动登录成 mock 微信用户。
                <br />
                正式模式需在服务器 .env 配置 WECHAT_APP_ID 等。
              </div>
            )}
            {!qr.mock && (
              <div className="dim-2" style={{ fontSize: 11, marginTop: 12 }}>
                二维码 10 分钟内有效
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
