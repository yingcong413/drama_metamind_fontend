import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { MicIcon } from "@/components/icons";
import { loginPassword, loginPhone, registerPhone } from "@/api/auth";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/cn";
import { PhoneCodeForm } from "./PhoneCodeForm";
import { PasswordForm } from "./PasswordForm";

type Mode = "login" | "signup";
type Method = "phone" | "account";

export function LoginPage() {
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const setUser = useAuthStore((s) => s.setUser);

  const [mode, setMode] = useState<Mode>("login");
  const [method, setMethod] = useState<Method>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(true);

  const showPhone = mode === "signup" || method === "phone";
  const phoneOk = /^1[3-9]\d{9}$/.test(phone);
  const codeOk = /^\d{6}$/.test(code);

  const submit = useMutation({
    mutationFn: async () => {
      if (mode === "signup") {
        if (!agreeTerms) throw new Error("请先同意用户协议");
        return registerPhone(phone, code, agreeTerms);
      }
      if (method === "phone") return loginPhone(phone, code, remember);
      return loginPassword(account, password, remember);
    },
    onSuccess: (r) => {
      setToken(r.token);
      setUser(r.user);
      navigate("/dashboard");
    },
  });

  const canSubmit = (() => {
    if (mode === "signup") return phoneOk && codeOk && agreeTerms;
    if (method === "phone") return phoneOk && codeOk;
    return account.length > 0 && password.length > 0;
  })();

  return (
    <div className="login-page" data-screen-label="Login">
      <div className="login-art">
        <div className="brand">
          <div className="brand-mark">制</div>
          <span>制影 AI</span>
        </div>
        <div className="quote">
          把视频生成的 17 个变量交还给创作者本身，
          而不是托付给一个不可控的输入框。
          <span className="who">— 制影 AI · 产品宣言</span>
        </div>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <svg
            viewBox="0 0 600 800"
            style={{ position: "absolute", right: "-100px", top: "20%", width: 400, opacity: 0.1 }}
          >
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth=".5" />
              </pattern>
            </defs>
            <rect width="600" height="800" fill="url(#grid)" />
          </svg>
        </div>
      </div>

      <div className="login-form-wrap">
        <div className="login-form">
          <div className="segmented" style={{ alignSelf: "flex-start" }}>
            <button className={cn(mode === "login" && "active")} onClick={() => setMode("login")}>
              登录
            </button>
            <button className={cn(mode === "signup" && "active")} onClick={() => setMode("signup")}>
              注册
            </button>
          </div>

          <h1>{mode === "login" ? "欢迎回来" : "开始你的第一个短剧"}</h1>
          <div className="sub">
            {mode === "login" ? "继续未完成的项目，或开启新的创作。" : "使用大陆手机号注册，免邮箱、免密码。"}
          </div>

          {mode === "login" && (
            <div className="login-method-tabs">
              <button
                className={cn(method === "phone" && "active")}
                onClick={() => setMethod("phone")}
              >
                <MicIcon /> 手机验证码
                <span className="dim-2 mono" style={{ fontSize: 9, marginLeft: 4 }}>推荐</span>
              </button>
              <button
                className={cn(method === "account" && "active")}
                onClick={() => setMethod("account")}
              >
                账号密码
              </button>
            </div>
          )}

          {showPhone ? (
            <PhoneCodeForm phone={phone} setPhone={setPhone} code={code} setCode={setCode} />
          ) : (
            <PasswordForm
              account={account}
              setAccount={setAccount}
              password={password}
              setPassword={setPassword}
              remember={remember}
              setRemember={setRemember}
            />
          )}

          {mode === "signup" && (
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                color: "var(--text-secondary)",
                fontSize: 12,
                cursor: "pointer",
                lineHeight: 1.6,
              }}
            >
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                我已阅读并同意 <a style={{ color: "var(--text)" }} href="#">《用户协议》</a> 与{" "}
                <a style={{ color: "var(--text)" }} href="#">《隐私政策》</a>。
              </span>
            </label>
          )}

          {submit.isError && (
            <div className="dim-2" style={{ fontSize: 12, color: "oklch(72% .15 25)" }}>
              {(submit.error as Error).message}
            </div>
          )}

          <button
            className="btn btn-primary btn-lg"
            style={{ justifyContent: "center" }}
            disabled={!canSubmit || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? "处理中…" : mode === "login" ? "登录" : "注册并登录"}
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "var(--text-tertiary)",
              fontSize: 11,
            }}
          >
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            或使用第三方
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>
          <button className="btn" style={{ justifyContent: "center", padding: "10px 14px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="oklch(70% .14 150)">
              <path d="M8.5 4C4.36 4 1 6.69 1 10c0 1.89 1.1 3.57 2.82 4.66L3 17.5l3.04-1.66c.78.21 1.6.33 2.46.33.13 0 .26 0 .39-.01-.25-.65-.39-1.36-.39-2.1 0-3.31 3.36-6 7.5-6 .35 0 .69.03 1.03.08C16.21 5.31 12.7 4 8.5 4zm-2.5 4.5a1 1 0 110 2 1 1 0 010-2zm5 0a1 1 0 110 2 1 1 0 010-2zm5.5 4c-3.59 0-6.5 2.24-6.5 5 0 1.51.86 2.86 2.24 3.79L11.5 23l2.45-1.43c.66.17 1.36.27 2.05.27 3.59 0 6.5-2.24 6.5-5s-2.91-5-6.5-5zm-2 3a.75.75 0 110 1.5.75.75 0 010-1.5zm4 0a.75.75 0 110 1.5.75.75 0 010-1.5z" />
            </svg>
            微信登录
          </button>

          {mode === "login" && (
            <div className="dim-2" style={{ fontSize: 11, marginTop: 4, textAlign: "center" }}>
              还没有账号？
              <button
                className="btn-ghost btn-sm"
                style={{ padding: 0, color: "var(--accent)" }}
                onClick={() => setMode("signup")}
              >
                立即注册
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
