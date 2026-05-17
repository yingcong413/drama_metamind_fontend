import { Field } from "@/components/primitives/Field";

interface Props {
  account: string;
  setAccount: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  remember: boolean;
  setRemember: (v: boolean) => void;
}

export function PasswordForm({ account, setAccount, password, setPassword, remember, setRemember }: Props) {
  return (
    <>
      <Field title="账号">
        <input
          className="input input-lg"
          placeholder="手机号 / 邮箱 / 账号"
          autoComplete="username"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        />
      </Field>
      <Field title="密码">
        <input
          className="input input-lg"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
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
          7 天内自动登录
        </label>
        <button className="btn-ghost btn-sm" style={{ padding: 0 }}>
          忘记密码？
        </button>
      </div>
    </>
  );
}
