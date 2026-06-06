import { useState } from "react";
import { EyeIcon } from "@/components/icons";
import { Field } from "@/components/primitives/Field";
import { useT } from "@/lib/i18n";

interface Props {
  account: string;
  setAccount: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  remember: boolean;
  setRemember: (v: boolean) => void;
}

export function PasswordForm({ account, setAccount, password, setPassword, remember, setRemember }: Props) {
  const t = useT();
  const [showPwd, setShowPwd] = useState(false);

  const onForgot = () => {
    alert(
      t("密码找回功能暂未开放\n\n测试期请联系管理员重置,或改用「手机验证码登录」。"),
    );
  };

  return (
    <>
      <Field title={t("账号")}>
        <input
          className="input input-lg"
          placeholder={t("手机号 / 姓名 / 邮箱 / 账号")}
          autoComplete="username"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        />
      </Field>
      <Field title={t("密码")}>
        <div style={{ position: "relative" }}>
          <input
            className="input input-lg"
            type={showPwd ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ paddingRight: 44 }}
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            title={showPwd ? t("隐藏密码") : t("显示密码")}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 6,
              color: showPwd ? "var(--accent)" : "var(--text-tertiary)",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <EyeIcon />
          </button>
        </div>
      </Field>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: -8 }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />{" "}
          {t("7 天内自动登录")}
        </label>
        <button
          type="button"
          className="btn-ghost btn-sm"
          style={{ padding: 0 }}
          onClick={onForgot}
        >
          {t("忘记密码？")}
        </button>
      </div>
    </>
  );
}
