import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { GithubIcon, GoogleIcon, MicIcon, SparkleIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { loginPassword, loginPhone, registerPhone } from "@/api/auth";
import { USE_REAL_AUTH } from "@/api/client";

// 旧 banner / Demo 一键登录 / "暂未开放" alert 只在 mock auth 模式下出现
const USE_MOCK_AUTH = !USE_REAL_AUTH;
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/cn";
import { PhoneCodeForm } from "./PhoneCodeForm";
import { PasswordForm } from "./PasswordForm";
import { WechatQrModal } from "./WechatQrModal";

type Mode = "login" | "signup";
type Method = "phone" | "account";

const DEMO_PHONE = "13800138000";
const DEMO_CODE = "123456";

const TERMS_TEXT = `用户协议(占位)

本平台仅供制影 AI 内部测试,请勿用于商业用途或上传敏感素材。
所有上传的素材与生成的视频,默认仅你自己可见。
正式上线前的协议条款将另行通知。`;

const PRIVACY_TEXT = `隐私政策(占位)

本平台收集:手机号(用于登录)、上传的素材(用于生成视频)、生成结果。
不会向第三方分享你的个人信息。
所有数据在 7 天内自动清理,测试期内不做长期保留。`;

export function LoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  // RequireAuth 在跳 /login 时把原路径放在 state.from,登录后跳回去
  const fromPath = (location.state as { from?: string } | null)?.from || "/dashboard";
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
  const [showWechat, setShowWechat] = useState(false);

  // PRD v0.9 §1.5:注册时选账户类型;企业账户需填公司名
  const [accountType, setAccountType] = useState<"personal" | "enterprise">("personal");
  const [orgName, setOrgName] = useState("");

  // OAuth 回调:Google/GitHub callback 完成后会 redirect 回 /login?token=...&from=...
  // 这里解析 URL 上的 token 写入 authStore,再跳到目标路径
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const cbToken = sp.get("token");
    const cbFrom = sp.get("from");
    if (cbToken) {
      setToken(cbToken);
      // 拉 /auth/me 拿用户信息
      fetch("/api/v1/auth/me", { headers: { Authorization: `Bearer ${cbToken}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((u) => {
          if (u) setUser(u);
          navigate(cbFrom || "/dashboard", { replace: true });
        })
        .catch(() => {
          navigate(cbFrom || "/dashboard", { replace: true });
        });
    }
    // 只在挂载时跑一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 微信扫码成功(从弹窗回传 token)
  const onWechatSuccess = async (token: string) => {
    setToken(token);
    try {
      const r = await fetch("/api/v1/auth/me", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setUser(await r.json());
    } catch {
      /* ignore */
    }
    setShowWechat(false);
    navigate(fromPath, { replace: true });
  };

  const showPhone = mode === "signup" || method === "phone";
  const phoneOk = /^1[3-9]\d{9}$/.test(phone);
  const codeOk = /^\d{6}$/.test(code);

  const submit = useMutation({
    mutationFn: async () => {
      if (mode === "signup") {
        if (!agreeTerms) throw new Error(t("请先同意用户协议"));
        if (accountType === "enterprise") {
          if (orgName.trim().length < 2 || orgName.trim().length > 30) {
            throw new Error(t("企业名称 2-30 字"));
          }
        }
        return registerPhone({
          phone,
          code,
          agree_terms: agreeTerms,
          account_type: accountType,
          org_name: accountType === "enterprise" ? orgName.trim() : undefined,
        });
      }
      if (method === "phone") return loginPhone(phone, code, remember);
      return loginPassword(account, password, remember);
    },
    onSuccess: (r) => {
      setToken(r.token);
      setUser(r.user);
      navigate(fromPath, { replace: true });
    },
  });

  /** 一键 Demo 登录(只在 mock 模式可用) */
  const demo = useMutation({
    mutationFn: () => loginPhone(DEMO_PHONE, DEMO_CODE, true),
    onSuccess: (r) => {
      setToken(r.token);
      setUser(r.user);
      navigate(fromPath, { replace: true });
    },
  });

  const canSubmit = (() => {
    if (mode === "signup") {
      const orgOk = accountType === "personal" || (orgName.trim().length >= 2 && orgName.trim().length <= 30);
      return phoneOk && codeOk && agreeTerms && orgOk;
    }
    if (method === "phone") return phoneOk && codeOk;
    return account.length > 0 && password.length > 0;
  })();

  /** Enter 提交表单(避免 form 嵌套,这里用 onKeyDown 包外层) */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && canSubmit && !submit.isPending) {
      e.preventDefault();
      submit.mutate();
    }
  };

  /**
   * 第三方 OAuth 入口:
   *   - USE_MOCK 模式弹友好 alert(纯前端 mock 不接真后端)
   *   - 真实模式:
   *     - Google/GitHub → 跳 /api/v1/auth/{p}/login,后端 redirect 到 provider,回调后 redirect 回前端
   *     - 微信 → 打开扫码弹窗(微信是扫码而非 redirect)
   */
  const openOAuth = (provider: "google" | "github" | "wechat") => {
    if (USE_MOCK_AUTH) {
      const names: Record<typeof provider, string> = {
        google: "Google",
        github: "GitHub",
        wechat: t("微信"),
      };
      alert(`${names[provider]} ${t("授权登录在 mock 模式下不可用\n\n请使用「Demo 一键登录」或手机验证码登录。\n生产模式(VITE_USE_MOCK=false)+ 后端配置好对应 OAuth 应用后即可使用。")}`);
      return;
    }
    if (provider === "wechat") {
      setShowWechat(true);
      return;
    }
    // Google / GitHub:整页 redirect 到后端,后端再 302 到 provider 授权页
    const state = encodeURIComponent(fromPath);
    window.location.href = `/api/v1/auth/${provider}/login?state=${state}`;
  };

  return (
    <div className="login-page" data-screen-label="Login">
      <div className="login-art">
        <div className="brand">
          <div className="brand-mark">制</div>
          <span>制影 AI</span>
        </div>
        <div className="quote">
          {t("把视频生成的 17 个变量交还给创作者本身，而不是托付给一个不可控的输入框。")}
          <span className="who">{t("— 制影 AI · 产品宣言")}</span>
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
        <div className="login-form" onKeyDown={onKeyDown}>
          {/* Demo 提示 banner —— 仅 mock 模式下显示 */}
          {USE_MOCK_AUTH && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(106,160,255,.10)",
                border: "1px solid rgba(106,160,255,.35)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}
            >
              {t("测试期所有人共用")} <strong style={{ color: "var(--text)" }}>{t("Demo 账号")}</strong>{t(",直接点下方按钮即可进入。如果想体验完整注册流程,可走「注册」标签输任意手机号 + 任意 6 位数字验证码。")}
            </div>
          )}

          <div className="segmented" style={{ alignSelf: "flex-start" }}>
            <button type="button" className={cn(mode === "login" && "active")} onClick={() => setMode("login")}>
              {t("登录")}
            </button>
            <button type="button" className={cn(mode === "signup" && "active")} onClick={() => setMode("signup")}>
              {t("注册")}
            </button>
          </div>

          <h1>{mode === "login" ? t("欢迎回来") : t("开始你的第一个短剧")}</h1>
          <div className="sub">
            {mode === "login" ? t("继续未完成的项目，或开启新的创作。") : t("使用大陆手机号注册，免邮箱、免密码。")}
          </div>

          {mode === "login" && (
            <div className="login-method-tabs">
              <button
                type="button"
                className={cn(method === "phone" && "active")}
                onClick={() => setMethod("phone")}
              >
                <MicIcon /> {t("手机验证码")}
                <span className="dim-2 mono" style={{ fontSize: 9, marginLeft: 4 }}>{t("推荐")}</span>
              </button>
              <button
                type="button"
                className={cn(method === "account" && "active")}
                onClick={() => setMethod("account")}
              >
                {t("账号密码")}
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="dim-2" style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>
                {t("账户类型")}
              </div>
              <div className="segmented" style={{ alignSelf: "stretch" }}>
                <button
                  type="button"
                  className={cn(accountType === "personal" && "active")}
                  onClick={() => setAccountType("personal")}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  {t("个人账户")}
                </button>
                <button
                  type="button"
                  className={cn(accountType === "enterprise" && "active")}
                  onClick={() => setAccountType("enterprise")}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  {t("企业账户")}
                </button>
              </div>
              <div className="dim-2" style={{ fontSize: 11, lineHeight: 1.6 }}>
                {accountType === "personal"
                  ? t("适合独立创作者:1 个席位、私人素材库、私人余额。")
                  : t("适合公司团队:默认 20 席位,组织内共享素材库,你是 Owner 可邀请成员。")}
              </div>
              {accountType === "enterprise" && (
                <input
                  className="input input-lg"
                  placeholder={t("公司名(2-30 字,可后续修改)")}
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  maxLength={30}
                />
              )}
            </div>
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
                {t("我已阅读并同意")}{" "}
                <a
                  style={{ color: "var(--text)", cursor: "pointer" }}
                  onClick={(e) => {
                    e.preventDefault();
                    alert(t(TERMS_TEXT));
                  }}
                >
                  {t("《用户协议》")}
                </a>{" "}
                {t("与")}{" "}
                <a
                  style={{ color: "var(--text)", cursor: "pointer" }}
                  onClick={(e) => {
                    e.preventDefault();
                    alert(t(PRIVACY_TEXT));
                  }}
                >
                  {t("《隐私政策》")}
                </a>
                {t("。")}
              </span>
            </label>
          )}

          {submit.isError && (
            <div className="dim-2" style={{ fontSize: 12, color: "oklch(72% .15 25)" }}>
              {(submit.error as Error).message}
            </div>
          )}
          {demo.isError && (
            <div className="dim-2" style={{ fontSize: 12, color: "oklch(72% .15 25)" }}>
              {t("Demo 登录失败")}:{(demo.error as Error).message}
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary btn-lg"
            style={{ justifyContent: "center" }}
            disabled={!canSubmit || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? t("处理中…") : mode === "login" ? t("登录") : t("注册并登录")}
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
            {t("或使用其它方式")}
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          {/* mock 模式下:在三件套上方多一个 Demo 一键登录的高亮主按钮 */}
          {USE_MOCK_AUTH && (
            <button
              type="button"
              className="btn"
              style={{
                justifyContent: "center",
                padding: "10px 14px",
                borderColor: "rgba(255,170,60,.5)",
                color: "oklch(78% .14 70)",
                background: "rgba(255,170,60,.06)",
              }}
              disabled={demo.isPending}
              onClick={() => demo.mutate()}
            >
              <SparkleIcon /> {demo.isPending ? t("登录中…") : t("使用 Demo 账号一键登录")}
            </button>
          )}

          {/* 第三方 OAuth 三件套:Google / GitHub / 微信 */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <OAuthIconButton
              label={t("使用 Google 账号登录")}
              onClick={() => openOAuth("google")}
            >
              <GoogleIcon />
            </OAuthIconButton>
            <OAuthIconButton
              label={t("使用 GitHub 账号登录")}
              onClick={() => openOAuth("github")}
            >
              <GithubIcon />
            </OAuthIconButton>
            <OAuthIconButton
              label={t("使用微信扫码登录")}
              onClick={() => openOAuth("wechat")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="oklch(70% .14 150)">
                <path d="M8.5 4C4.36 4 1 6.69 1 10c0 1.89 1.1 3.57 2.82 4.66L3 17.5l3.04-1.66c.78.21 1.6.33 2.46.33.13 0 .26 0 .39-.01-.25-.65-.39-1.36-.39-2.1 0-3.31 3.36-6 7.5-6 .35 0 .69.03 1.03.08C16.21 5.31 12.7 4 8.5 4zm-2.5 4.5a1 1 0 110 2 1 1 0 010-2zm5 0a1 1 0 110 2 1 1 0 010-2zm5.5 4c-3.59 0-6.5 2.24-6.5 5 0 1.51.86 2.86 2.24 3.79L11.5 23l2.45-1.43c.66.17 1.36.27 2.05.27 3.59 0 6.5-2.24 6.5-5s-2.91-5-6.5-5zm-2 3a.75.75 0 110 1.5.75.75 0 010-1.5zm4 0a.75.75 0 110 1.5.75.75 0 010-1.5z" />
              </svg>
            </OAuthIconButton>
          </div>

          {mode === "login" && (
            <div className="dim-2" style={{ fontSize: 11, marginTop: 4, textAlign: "center" }}>
              {t("还没有账号？")}
              <button
                type="button"
                className="btn-ghost btn-sm"
                style={{ padding: 0, color: "var(--accent)" }}
                onClick={() => setMode("signup")}
              >
                {t("立即注册")}
              </button>
            </div>
          )}
        </div>
      </div>

      {showWechat && (
        <WechatQrModal
          onClose={() => setShowWechat(false)}
          onSuccess={onWechatSuccess}
        />
      )}
    </div>
  );
}

/** 第三方登录 icon 按钮:正方形,只显示 logo,hover tooltip 解释 */
function OAuthIconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        width: 44,
        height: 44,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 8,
        cursor: "pointer",
        color: "var(--text)",
        transition: "background .15s, border-color .15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
      }}
    >
      {children}
    </button>
  );
}
