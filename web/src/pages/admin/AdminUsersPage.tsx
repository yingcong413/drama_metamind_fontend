// AdminUsersPage.tsx —— 平台管理员:管理所有账号(设/取消验证账号、改本月额度)。
//
// 仅 user.is_platform_admin === true 可见。验证账号:仅其能看到生成视频的提示词 / JSON。

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { useIsPlatformAdmin } from "@/stores/auth";
import { listAdminUsers, patchAdminUser, type AdminUserItem } from "@/api/admin";
import { formatYuan } from "@/lib/format";
import { useT, useTf } from "@/lib/i18n";

export function AdminUsersPage() {
  const isAdmin = useIsPlatformAdmin();
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <UsersBody />;
}

function UsersBody() {
  const t = useT();
  const tf = useTf();
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const usersQuery = useQuery({
    queryKey: ["admin-users", q],
    queryFn: () => listAdminUsers({ q, page_size: 100 }),
    staleTime: 2000,
  });

  const mut = useMutation({
    mutationFn: (v: { id: string; body: { is_verification_account?: boolean; monthly_quota_cents?: number } }) =>
      patchAdminUser(v.id, v.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e) => alert(tf("更新失败:{msg}", { msg: e instanceof Error ? e.message : String(e) })),
  });

  const rows = usersQuery.data?.list ?? [];

  const editQuota = (u: AdminUserItem) => {
    const cur = (u.monthly_quota_cents / 100).toString();
    const input = window.prompt(
      tf("给「{name}」设置本月额度(元，0=不限额):", { name: u.name }),
      cur,
    );
    if (input === null) return;
    const yuan = parseFloat(input);
    if (!Number.isFinite(yuan) || yuan < 0) {
      alert(t("请输入 ≥ 0 的数字"));
      return;
    }
    mut.mutate({ id: u.id, body: { monthly_quota_cents: Math.round(yuan * 100) } });
  };

  return (
    <>
      <AppTopBar crumbs={[{ label: t("平台管理") }, { label: t("账号管理") }]} />
      <div className="char-lib" style={{ maxWidth: 1100 }}>
        <h1>{t("账号管理 — 平台管理员")}</h1>
        <p className="char-lib-sub" style={{ marginBottom: 16 }}>
          {t("管理全平台账号。「验证账号」开启后，该账号才能在生成视频时看到提示词与 JSON 详情；本月额度用于限制该用户当月消费（0=不限额）。")}
        </p>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <input
            className="input"
            style={{ flex: 1, maxWidth: 320 }}
            placeholder={t("按 姓名 / 手机 / 邮箱 / id 过滤…")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="dim-2 mono" style={{ fontSize: 12 }}>
            {tf("共 {n} 个", { n: usersQuery.data?.total ?? 0 })}
          </span>
        </div>

        {usersQuery.isLoading ? (
          <div className="dim" style={{ padding: 24 }}>{t("加载中…")}</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 24, background: "var(--surface-2)", borderRadius: 8, color: "var(--text-tertiary)", fontSize: 13, textAlign: "center" }}>
            {t("没有匹配的账号")}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", color: "var(--text-secondary)", fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase" }}>
                <th style={{ padding: 10, textAlign: "left" }}>{t("账号")}</th>
                <th style={{ padding: 10, textAlign: "left" }}>{t("所属组织")}</th>
                <th style={{ padding: 10, textAlign: "left" }}>{t("角色")}</th>
                <th style={{ padding: 10, textAlign: "center" }}>{t("验证账号")}</th>
                <th style={{ padding: 10, textAlign: "right" }}>{t("本月额度")}</th>
                <th style={{ padding: 10, textAlign: "right" }}>{t("本月消费")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: 10 }}>
                    <div style={{ fontWeight: 500 }}>
                      {u.name}
                      {u.is_platform_admin && (
                        <span className="dim-2 mono" style={{ fontSize: 10, marginLeft: 6, color: "oklch(72% .14 70)" }}>ADMIN</span>
                      )}
                    </div>
                    <div className="dim-2 mono" style={{ fontSize: 11 }}>{u.phone || u.email || u.id}</div>
                  </td>
                  <td style={{ padding: 10 }}>
                    {u.org_name}
                    <span className="dim-2" style={{ fontSize: 11 }}> · {u.account_type === "enterprise" ? t("企业") : t("个人")}</span>
                  </td>
                  <td style={{ padding: 10 }}>{u.role === "owner" ? t("Owner") : t("成员")}</td>
                  <td style={{ padding: 10, textAlign: "center" }}>
                    <button
                      className={u.is_verification_account ? "btn btn-sm btn-primary" : "btn btn-sm"}
                      disabled={mut.isPending}
                      onClick={() => mut.mutate({ id: u.id, body: { is_verification_account: !u.is_verification_account } })}
                    >
                      {u.is_verification_account ? t("是 · 点击取消") : t("否 · 设为验证账号")}
                    </button>
                  </td>
                  <td style={{ padding: 10, textAlign: "right" }} className="mono">
                    <button className="btn-link" onClick={() => editQuota(u)}>
                      {u.monthly_quota_cents > 0 ? `¥${formatYuan(u.monthly_quota_cents)}` : t("不限")}
                    </button>
                  </td>
                  <td style={{ padding: 10, textAlign: "right" }} className="mono dim-2">
                    ¥{formatYuan(u.month_spent_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
