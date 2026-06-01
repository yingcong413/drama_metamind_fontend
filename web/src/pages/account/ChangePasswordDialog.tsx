import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CloseIcon } from "@/components/icons";
import { changePassword } from "@/api/auth";
import { useT } from "@/lib/i18n";

interface Props {
  onClose: () => void;
}

export function ChangePasswordDialog({ onClose }: Props) {
  const t = useT();
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [done, setDone] = useState(false);

  // 表单层校验
  const localError =
    !oldPwd ? null
    : !newPwd ? null
    : newPwd.length < 6 ? t("新密码至少 6 位")
    : confirmPwd && newPwd !== confirmPwd ? t("两次密码不一致")
    : null;
  const canSubmit =
    oldPwd && newPwd && confirmPwd && newPwd === confirmPwd && newPwd.length >= 6;

  const submit = useMutation({
    mutationFn: () => changePassword({ old_password: oldPwd, new_password: newPwd }),
    onSuccess: () => setDone(true),
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(0,0,0,.55)",
        display: "grid", placeItems: "center",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 92vw)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0,0,0,.5)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600 }}>{t("修改密码")}</div>
          <button className="btn-ghost btn-icon" onClick={onClose} title={t("关闭")}>
            <CloseIcon />
          </button>
        </div>

        {done ? (
          <div style={{ padding: 28, textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              {t("✓ 密码修改成功")}
            </div>
            <div className="dim-2" style={{ fontSize: 12, marginBottom: 18 }}>
              {t("下次登录请使用新密码。")}
            </div>
            <button className="btn btn-primary" onClick={onClose}>
              {t("知道了")}
            </button>
          </div>
        ) : (
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <Field
              label={t("旧密码")}
              value={oldPwd}
              onChange={setOldPwd}
              placeholder={t("当前账号密码")}
            />
            <Field
              label={t("新密码")}
              value={newPwd}
              onChange={setNewPwd}
              placeholder={t("至少 6 位")}
            />
            <Field
              label={t("确认新密码")}
              value={confirmPwd}
              onChange={setConfirmPwd}
              placeholder={t("再输一次新密码")}
            />

            {(localError || submit.isError) && (
              <div className="dim-2" style={{ fontSize: 12, color: "oklch(72% .15 25)" }}>
                {localError || (submit.error as Error)?.message}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
              <button className="btn btn-sm" onClick={onClose}>
                {t("取消")}
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!canSubmit || submit.isPending}
                onClick={() => submit.mutate()}
              >
                {submit.isPending ? t("提交中…") : t("确认修改")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="dim-2" style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em" }}>
        {label}
      </span>
      <input
        type="password"
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        style={{ padding: "10px 12px", fontSize: 14 }}
      />
    </label>
  );
}
