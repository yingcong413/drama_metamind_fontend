// AdminProjectsPage.tsx —— 平台管理员:查看全平台项目，一键导入复现
//
// 仅 user.is_platform_admin === true 可见。列出所有用户的项目（org/owner/状态），
// 点「导入复现」会把该项目克隆进管理员自己的 org，然后跳进编辑器，便于复现用户问题。

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { useIsPlatformAdmin } from "@/stores/auth";
import { importAdminProject, listAdminProjects, type AdminProjectItem } from "@/api/admin";
import { useT, useTf } from "@/lib/i18n";

export function AdminProjectsPage() {
  const isAdmin = useIsPlatformAdmin();
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <ProjectsBody />;
}

function ProjectsBody() {
  const t = useT();
  const tf = useTf();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const projectsQuery = useQuery({
    queryKey: ["admin-projects", q],
    queryFn: () => listAdminProjects({ q, page_size: 100 }),
    staleTime: 2000,
  });

  const importMut = useMutation({
    mutationFn: (id: string) => importAdminProject(id),
    onSuccess: (p) => {
      // 导入成功 → 直接进编辑器复现
      navigate(`/projects/${p.id}/edit`);
    },
    onError: (e) => {
      alert(tf("导入失败:{msg}", { msg: e instanceof Error ? e.message : String(e) }));
    },
  });

  const rows = projectsQuery.data?.list ?? [];

  return (
    <>
      <AppTopBar crumbs={[{ label: t("平台管理") }, { label: t("所有项目") }]} />
      <div className="char-lib" style={{ maxWidth: 1100 }}>
        <h1>{t("所有项目 — 平台管理员")}</h1>
        <p className="char-lib-sub" style={{ marginBottom: 16 }}>
          {t("查看全平台用户的项目。点「导入复现」会把该项目克隆进你自己的账号并打开编辑器，用于复现用户遇到的问题（不影响原项目）。")}
        </p>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <input
            className="input"
            style={{ flex: 1, maxWidth: 320 }}
            placeholder={t("按项目名过滤…")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="dim-2 mono" style={{ fontSize: 12 }}>
            {tf("共 {n} 个", { n: projectsQuery.data?.total ?? 0 })}
          </span>
        </div>

        {projectsQuery.isLoading ? (
          <div className="dim" style={{ padding: 24 }}>{t("加载中…")}</div>
        ) : rows.length === 0 ? (
          <div
            style={{
              padding: 24, background: "var(--surface-2)", borderRadius: 8,
              color: "var(--text-tertiary)", fontSize: 13, textAlign: "center",
            }}
          >
            {t("没有匹配的项目")}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr
                style={{
                  background: "var(--surface-2)", color: "var(--text-secondary)",
                  fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase",
                }}
              >
                <th style={{ padding: 10, textAlign: "left" }}>{t("项目")}</th>
                <th style={{ padding: 10, textAlign: "left" }}>{t("所属账户")}</th>
                <th style={{ padding: 10, textAlign: "left" }}>{t("创建者")}</th>
                <th style={{ padding: 10, textAlign: "left" }}>{t("状态")}</th>
                <th style={{ padding: 10, textAlign: "right" }}>{t("分镜")}</th>
                <th style={{ padding: 10, textAlign: "left" }}>{t("更新时间")}</th>
                <th style={{ padding: 10, textAlign: "right" }}>{t("操作")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p: AdminProjectItem) => (
                <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: 10 }}>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    <div className="dim-2 mono" style={{ fontSize: 11 }}>{p.id}</div>
                  </td>
                  <td style={{ padding: 10 }}>
                    {p.org_name}
                    <div className="dim-2 mono" style={{ fontSize: 11 }}>{p.org_id}</div>
                  </td>
                  <td style={{ padding: 10 }}>{p.owner_name}</td>
                  <td style={{ padding: 10 }}>
                    {p.status === "done" ? t("已完成") : p.status === "gen" ? t("生成中") : t("草稿")}
                  </td>
                  <td style={{ padding: 10, textAlign: "right" }} className="mono dim-2">{p.shot_count}</td>
                  <td style={{ padding: 10 }} className="mono dim-2">
                    {new Date(p.updated_at).toLocaleString()}
                  </td>
                  <td style={{ padding: 10, textAlign: "right" }}>
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={importMut.isPending}
                      onClick={() => importMut.mutate(p.id)}
                    >
                      {importMut.isPending && importMut.variables === p.id ? t("导入中…") : t("导入复现")}
                    </button>
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
