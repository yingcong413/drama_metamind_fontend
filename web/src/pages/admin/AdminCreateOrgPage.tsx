// AdminCreateOrgPage.tsx —— PRD §1.5.6 / v0.9.5 平台管理员替客户开企业账户
//
// 仅 user.is_platform_admin === true 可见。
// 用途:B2B 线下成交后,运营/销售直接录入客户手机号 + 公司名,
//      一次性建好企业 Owner 账户(可选首笔充值),省去让客户走完整注册流的成本。
//
// 提交成功后页面切到「结果卡片」视图,展示:user.id / org.id / 余额 +
// 复制按钮 + 操作指引(让客户首次用 SMS 验证码登录,无需密码)。

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { useIsPlatformAdmin } from "@/stores/auth";
import {
  createAdminOrg,
  type CreateAdminOrgResponse,
} from "@/api/admin";
import { formatYuan } from "@/lib/format";
import { useT, useTf } from "@/lib/i18n";

const PHONE_RE = /^1[3-9]\d{9}$/;

export function AdminCreateOrgPage() {
  const isAdmin = useIsPlatformAdmin();
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return <CreateOrgBody />;
}

function CreateOrgBody() {
  const t = useT();
  const tf = useTf();
  const navigate = useNavigate();

  // ── 表单字段 ──
  const [phone, setPhone] = useState("");
  const [orgName, setOrgName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [initialYuan, setInitialYuan] = useState(""); // 元,可空
  const [note, setNote] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  /** 生成 8 位易读密码:大小写字母 + 数字,排除易混 (0/O/1/l/I) */
  const genPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 8; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    setInitialPassword(out);
  };

  const initialCents = useMemo(() => {
    const n = parseFloat(initialYuan);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  }, [initialYuan]);

  // ── 校验 ──
  const phoneOk = PHONE_RE.test(phone);
  const orgNameOk = orgName.trim().length >= 2 && orgName.trim().length <= 30;
  const ownerNameOk = ownerName.trim().length === 0 || ownerName.trim().length <= 30;
  const passwordOk =
    initialPassword.length === 0 ||
    (initialPassword.length >= 6 && initialPassword.length <= 64);
  const noteOk =
    initialCents === 0 ||
    (note.trim().length >= 2 && note.trim().length <= 200);
  const canSubmit = phoneOk && orgNameOk && ownerNameOk && passwordOk && noteOk;

  // ── 提交 ──
  const [result, setResult] = useState<CreateAdminOrgResponse | null>(null);
  const create = useMutation({
    mutationFn: () =>
      createAdminOrg({
        phone: phone.trim(),
        org_name: orgName.trim(),
        owner_name: ownerName.trim() || undefined,
        initial_password: initialPassword || undefined,
        initial_balance_cents: initialCents || undefined,
        note: initialCents > 0 ? note.trim() : undefined,
      }),
    onSuccess: (r) => {
      // 保存这次提交的明文密码,只用于本次结果展示(刷新页面就丢)
      setShowPasswordInResult(initialPassword);
      setResult(r);
      setShowConfirm(false);
    },
    onError: (e) => {
      alert(tf("创建失败:{msg}", { msg: (e as Error).message }));
      setShowConfirm(false);
    },
  });

  const resetForm = () => {
    setPhone("");
    setOrgName("");
    setOwnerName("");
    setInitialPassword("");
    setInitialYuan("");
    setNote("");
    setResult(null);
  };

  // 把 initial password 透传给 ResultCard 显示;后端响应里**不会**回传明文密码,
  // 所以这里在客户端记一份临时变量,只在「这次创建结果」卡片里展示
  const [showPasswordInResult, setShowPasswordInResult] = useState<string>("");

  return (
    <>
      <AppTopBar crumbs={[{ label: t("平台管理") }, { label: t("替人开企业") }]} />
      <div
        style={{
          maxWidth: 720,
          margin: "32px auto",
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {!result && (
          <>
            <header>
              <h1 style={{ margin: 0, fontSize: 22 }}>
                {t("替客户开通企业账户")}
              </h1>
              <div className="dim-2" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
                {t("填写客户手机号 + 公司名一次性建好。可顺手做首笔线下充值。")}
                <br />
                {t("创建完成后,客户用该手机号在登录页发送验证码即可登录(无需密码)。")}
              </div>
            </header>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 24,
              }}
            >
              <Field
                label={t("客户手机号")}
                hint={t("11 位中国大陆手机号")}
                error={phone && !phoneOk ? t("格式不对") : ""}
              >
                <input
                  className="input"
                  type="tel"
                  placeholder="138 0013 8000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\s+/g, ""))}
                  maxLength={11}
                />
              </Field>

              <Field
                label={t("公司 / 组织名称")}
                hint={t("2-30 字,后续 Owner 可在 /org 页修改")}
                error={orgName && !orgNameOk ? t("公司名 2-30 字") : ""}
              >
                <input
                  className="input"
                  placeholder={t("云山影视有限公司")}
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  maxLength={30}
                />
              </Field>

              <Field
                label={t("Owner 姓名(可选)")}
                hint={t("留空 = 用「用户XXXX」(取手机号后 4 位)")}
                error={ownerName && !ownerNameOk ? t("姓名不超过 30 字") : ""}
              >
                <input
                  className="input"
                  placeholder={t("张小明")}
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  maxLength={30}
                />
              </Field>

              <Field
                label={t("初始密码(可选)")}
                hint={t("留空 = 仅可用 SMS 验证码登录。SMS 暂不通时设个密码,客户用手机号 + 密码登录。6-64 位。")}
                error={initialPassword && !passwordOk ? t("密码 6-64 位") : ""}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="input"
                    type="text"
                    placeholder={t("留空 / 或自定义")}
                    value={initialPassword}
                    onChange={(e) => setInitialPassword(e.target.value)}
                    maxLength={64}
                    style={{ flex: 1, fontFamily: "var(--font-mono)" }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={genPassword}
                    title={t("生成 8 位随机密码")}
                  >
                    {t("生成")}
                  </button>
                </div>
              </Field>

              <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />

              <Field
                label={t("首笔充值金额(元,可选)")}
                hint={t("留空或 0 = 不充;>0 会生成一笔 admin_manual 流水,可在「手动充值」页查看")}
              >
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={t("例如 5000")}
                  value={initialYuan}
                  onChange={(e) => setInitialYuan(e.target.value)}
                />
              </Field>

              {initialCents > 0 && (
                <Field
                  label={t("充值备注(必填)")}
                  hint={t("对账依据,2-200 字。例:线下银行转账 / 微信收款")}
                  error={note && !noteOk ? t("备注 2-200 字") : ""}
                >
                  <textarea
                    className="input"
                    rows={2}
                    placeholder={t("例:已收到客户银行转账 ¥5000,凭证 No.20260529-001")}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={200}
                  />
                </Field>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 8,
                }}
              >
                <button
                  className="btn"
                  onClick={() => navigate("/admin/recharge")}
                  disabled={create.isPending}
                >
                  {t("取消")}
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!canSubmit || create.isPending}
                  onClick={() => setShowConfirm(true)}
                >
                  {create.isPending ? t("创建中…") : t("创建企业账户")}
                </button>
              </div>
            </div>
          </>
        )}

        {/* 二次确认 */}
        {showConfirm && !result && (
          <div className="modal-mask" onClick={() => setShowConfirm(false)}>
            <div
              className="modal"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 480 }}
            >
              <h3 style={{ marginTop: 0 }}>{t("确认创建企业账户?")}</h3>
              <ul style={{ fontSize: 14, lineHeight: 1.8, paddingLeft: 20 }}>
                <li>{t("手机号")} <strong>{phone}</strong></li>
                <li>{t("公司")} <strong>{orgName.trim()}</strong></li>
                {ownerName.trim() && <li>{t("Owner 姓名")} <strong>{ownerName.trim()}</strong></li>}
                {initialCents > 0 && (
                  <li>
                    {t("首笔充值")} <strong>¥{formatYuan(initialCents)}</strong>
                    <br />
                    <span className="dim-2" style={{ fontSize: 12 }}>
                      {tf("备注:{note}", { note: note.trim() })}
                    </span>
                  </li>
                )}
              </ul>
              <div className="dim-2" style={{ fontSize: 12, marginTop: 10 }}>
                {t("若该手机号已是另一家企业 Owner / 其它组织 Member,创建会失败。")}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 18,
                }}
              >
                <button
                  className="btn"
                  onClick={() => setShowConfirm(false)}
                  disabled={create.isPending}
                >
                  {t("返回修改")}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => create.mutate()}
                  disabled={create.isPending}
                >
                  {create.isPending ? t("提交中…") : t("确认创建")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 结果 */}
        {result && (
          <ResultCard
            result={result}
            plainPassword={showPasswordInResult || null}
            onReset={resetForm}
          />
        )}
      </div>
    </>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
      {children}
      {hint && (
        <span className="dim-2" style={{ fontSize: 11, lineHeight: 1.6 }}>
          {hint}
        </span>
      )}
      {error && (
        <span style={{ fontSize: 12, color: "oklch(60% .20 25)" }}>
          {error}
        </span>
      )}
    </label>
  );
}

function ResultCard({
  result,
  plainPassword,
  onReset,
}: {
  result: CreateAdminOrgResponse;
  /** 这次创建时填的明文密码,只在结果页展示一次。null = 未设密码 */
  plainPassword: string | null;
  onReset: () => void;
}) {
  const t = useT();
  const tf = useTf();
  const navigate = useNavigate();
  const { user, organization, account, initial_recharge } = result;
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 28,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            background: "oklch(70% .18 145)",
            color: "white",
            display: "grid",
            placeItems: "center",
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          ✓
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>{t("企业账户创建成功")}</h2>
          <div className="dim-2" style={{ fontSize: 12, marginTop: 4 }}>
            {user.is_new
              ? t("已新建用户 + 企业组织 + 余额账户")
              : t("该手机号已存在用户,组织已升级为企业账户")}
          </div>
        </div>
      </div>

      <KV label={t("企业名称")} value={organization.name} />
      <KV label={t("企业 ID")} value={organization.id} onCopy={() => copy(organization.id)} mono />
      <KV label={t("席位上限")} value={tf("{n} 席", { n: organization.seat_limit })} />
      <KV label={t("Owner 姓名")} value={user.name} />
      <KV label={t("Owner 手机号")} value={user.phone ?? ""} onCopy={() => user.phone && copy(user.phone)} mono />
      <KV label={t("Owner 用户 ID")} value={user.id} onCopy={() => copy(user.id)} mono />
      {user.password_set && plainPassword && (
        <KV
          label={t("初始密码")}
          value={plainPassword}
          onCopy={() => copy(plainPassword)}
          mono
          emphasis
        />
      )}
      <KV
        label={t("当前余额")}
        value={`¥${formatYuan(account.balance_cents)}`}
        emphasis
      />
      {initial_recharge && (
        <KV
          label={t("首笔充值")}
          value={tf("¥{amt} (流水 {id})", { amt: formatYuan(initial_recharge.amount_cents), id: initial_recharge.id })}
          mono
        />
      )}

      <div
        style={{
          marginTop: 22,
          padding: 14,
          background: "rgba(255,180,0,.08)",
          border: "1px solid rgba(255,180,0,.3)",
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.7,
        }}
      >
        <strong>{t("转告客户:")}</strong>
        <br />
        {t("登录地址")} <span className="mono">{location.origin}/login</span>
        <br />
        {user.password_set && plainPassword ? (
          <>
            {t("登录方式:在登录页切到「账号密码」Tab,输入手机号")}{" "}
            <strong className="mono">{user.phone}</strong> {t("+ 密码")}{" "}
            <strong className="mono">{plainPassword}</strong> {t("→ 登录。")}
            <br />
            {t("首次登录后建议在「账户」页改密码,该初始密码本次离开此页就再也看不到。")}
          </>
        ) : (
          <>
            {t("登录方式:输入手机号")} <strong className="mono">{user.phone}</strong>,
            {t("点「发送验证码」,收到 4 位短信验证码后填入并点登录。")}
            <br />
            <span style={{ color: "oklch(60% .20 25)" }}>
              {t("⚠ SMS 暂未接通时此方式不可用,建议返回上一步重新创建并设置初始密码。")}
            </span>
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          marginTop: 24,
        }}
      >
        <button className="btn" onClick={onReset}>
          {t("继续创建下一个")}
        </button>
        <button
          className="btn btn-primary"
          onClick={() => navigate("/admin/recharge")}
        >
          {t("返回管理首页")}
        </button>
      </div>
    </div>
  );
}

function KV({
  label,
  value,
  onCopy,
  mono,
  emphasis,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  mono?: boolean;
  emphasis?: boolean;
}) {
  const t = useT();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span className="dim-2" style={{ fontSize: 12, minWidth: 100 }}>
        {label}
      </span>
      <span
        className={mono ? "mono" : ""}
        style={{
          flex: 1,
          fontSize: emphasis ? 18 : 14,
          fontWeight: emphasis ? 600 : 400,
          color: emphasis ? "var(--accent)" : "var(--text)",
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
      {onCopy && (
        <button
          className="btn btn-sm"
          onClick={onCopy}
          style={{ fontSize: 11, padding: "2px 8px" }}
          title={t("复制")}
        >
          {t("复制")}
        </button>
      )}
    </div>
  );
}
