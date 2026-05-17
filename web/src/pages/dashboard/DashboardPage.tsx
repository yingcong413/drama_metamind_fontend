import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { PlusIcon } from "@/components/icons";
import { listProjects } from "@/api/projects";
import { ProjectCard } from "./ProjectCard";
import { NewProjectCard } from "./NewProjectCard";
import { DashboardToolbar, type StatusFilter } from "./DashboardToolbar";

export function DashboardPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");

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

  const onCreate = () => {
    navigate(`/projects/new/edit`);
  };

  return (
    <>
      <AppTopBar
        crumbs={[{ label: "项目" }]}
        actions={
          <button className="btn-primary btn btn-sm" onClick={onCreate}>
            <PlusIcon /> 新建
          </button>
        }
      />
      <div className="dash" data-screen-label="Dashboard">
        <div className="dash-header">
          <div>
            <h1>我的短剧项目</h1>
            <div className="dim">
              {isLoading ? "加载中…" : `共 ${counts.all} 个项目 · 上次同步刚刚`}
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
            加载失败：{(error as Error).message}
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
    </>
  );
}
