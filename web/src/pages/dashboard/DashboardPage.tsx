import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useT, useTf } from "@/lib/i18n";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { PlusIcon } from "@/components/icons";
import { createProject, listProjects } from "@/api/projects";
import { ProjectCard } from "./ProjectCard";
import { NewProjectCard } from "./NewProjectCard";
import { DashboardToolbar, type StatusFilter } from "./DashboardToolbar";
import { NameProjectDialog } from "./NameProjectDialog";

export function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["projects", { status: filter, q }],
    queryFn: () => listProjects({ status: filter, q }),
  });

  const allCounts = useQuery({
    queryKey: ["projects", "counts"],
    queryFn: () => listProjects({ page_size: 100 }),
    select: (r) => ({
      all: r.total,
      draft: r.list.filter((p) => p.status === "draft").length,
      done: r.list.filter((p) => p.status === "done").length,
      gen: r.list.filter((p) => p.status === "gen").length,
    }),
  });

  const counts = useMemo(
    () => allCounts.data ?? { all: 0, draft: 0, done: 0, gen: 0 },
    [allCounts.data],
  );

  // v0.7：「新建」走真实 POST /projects，拿到 id 再跳编辑器
  // 弹窗收集名字后提交，提交期间 create.isPending 让弹窗按钮 disabled
  const create = useMutation({
    mutationFn: (name: string) => createProject({ name }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setDialogOpen(false);
      navigate(`/projects/${p.id}/edit`);
    },
    onError: (e) => {
      console.error("新建项目失败", e);
      alert(`${t("新建失败")}：${(e as Error).message}`);
    },
  });

  const onCreate = () => {
    if (create.isPending) return;
    setDialogOpen(true);
  };

  const t = useT();
  const tf = useTf();

  return (
    <>
      <AppTopBar
        crumbs={[{ label: t("项目") }]}
        actions={
          <button className="btn-primary btn btn-sm" onClick={onCreate}>
            <PlusIcon /> {t("新建")}
          </button>
        }
      />
      <div className="dash" data-screen-label="Dashboard">
        <div className="dash-header">
          <div>
            <h1>{t("我的短剧项目")}</h1>
            <div className="dim">
              {isLoading ? t("加载中…") : tf("共 {n} 个项目 · 上次同步刚刚", { n: counts.all })}
            </div>
          </div>
          <DashboardToolbar
            filter={filter}
            setFilter={setFilter}
            counts={counts}
            q={q}
            setQ={setQ}
            onCreate={onCreate}
          />
        </div>

        {isError && (
          <div className="dim" style={{ padding: 24 }}>
            {t("加载失败")}：{(error as Error).message}
          </div>
        )}

        <div className="proj-grid">
          <NewProjectCard onClick={onCreate} />
          {(data?.list ?? []).map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.3 } }`}</style>

      <NameProjectDialog
        open={dialogOpen}
        pending={create.isPending}
        onClose={() => setDialogOpen(false)}
        onSubmit={(name) => create.mutate(name)}
      />
    </>
  );
}
