import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Avatar } from "@/components/primitives/Avatar";
import { EditIcon, KeyIcon } from "@/components/icons";
import { updateUser } from "@/api/auth";
import { useAuthStore } from "@/stores/auth";
import { useT } from "@/lib/i18n";

interface Props {
  onChangePassword: () => void;
}

export function AccountInfoCard({ onChangePassword }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  // 仅个人 Owner 显示「升级为企业账户」CTA
  // 企业 Owner 已在头像菜单看到「组织管理」入口;Member 没权限升级
  const showUpgradeCta =
    user?.role === "owner" && user?.org?.account_type === "personal";

  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState(user?.name ?? "");

  useEffect(() => {
    setDraft(user?.name ?? "");
  }, [user?.name]);

  const save = useMutation({
    mutationFn: (name: string) => updateUser({ name }),
    onSuccess: (r) => {
      if (user && r.name) setUser({ ...user, name: r.name });
      setEditingName(false);
    },
  });

  const cancelEdit = () => {
    setDraft(user?.name ?? "");
    setEditingName(false);
  };

  if (!user) {
    return (
      <section
        style={{
          padding: 20,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          marginBottom: 20,
          color: "var(--text-tertiary)",
          fontSize: 13,
        }}
      >
        {t("未登录")}
      </section>
    );
  }

  return (
    <section
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: 20,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        marginBottom: 20,
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <Avatar name={user.name || t("你")} size="xl" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 昵称(可编辑) */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {editingName ? (
            <>
              <input
                className="input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && draft.trim() && draft !== user.name) {
                    save.mutate(draft.trim());
                  } else if (e.key === "Escape") {
                    cancelEdit();
                  }
                }}
                autoFocus
                maxLength={20}
                style={{ padding: "6px 10px", fontSize: 16, fontWeight: 600, width: 200 }}
              />
              <button
                className="btn btn-sm btn-primary"
                disabled={!draft.trim() || draft === user.name || save.isPending}
                onClick={() => save.mutate(draft.trim())}
              >
                {save.isPending ? t("保存中…") : t("保存")}
              </button>
              <button className="btn btn-sm" onClick={cancelEdit}>
                {t("取消")}
              </button>
            </>
          ) : (
            <>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{user.name}</h2>
              <button
                className="btn-ghost btn-sm"
                title={t("修改昵称")}
                onClick={() => setEditingName(true)}
                style={{ padding: 4 }}
              >
                <EditIcon />
              </button>
            </>
          )}
        </div>

        {/* 资料明细 */}
        <div
          style={{
            display: "flex",
            gap: 24,
            marginTop: 8,
            flexWrap: "wrap",
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          <InfoItem label={t("手机号")} value={user.phone || t("未绑定")} mono />
          <InfoItem label={t("用户 ID")} value={user.id} mono />
          <InfoItem label={t("登录方式")} value={t("手机验证码")} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
        {showUpgradeCta && (
          <button
            className="btn btn-sm btn-primary"
            title={t("升级为企业账户:邀请同事、共享素材库、统一发票")}
            onClick={() => navigate("/org")}
          >
            {t("⇪ 升级为企业账户")}
          </button>
        )}
        <button className="btn btn-sm" onClick={onChangePassword}>
          <KeyIcon /> {t("修改密码")}
        </button>
        <button
          className="btn-ghost btn-sm"
          style={{ color: "oklch(72% .15 25)" }}
          onClick={() => {
            if (confirm(t("确定要退出登录吗?"))) {
              logout();
              window.location.href = "/login";
            }
          }}
        >
          {t("退出登录")}
        </button>
      </div>
    </section>
  );
}

function InfoItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div
        className="dim-2"
        style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em" }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 13,
          color: "var(--text)",
          fontFamily: mono ? "var(--font-mono)" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}
