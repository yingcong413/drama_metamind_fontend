import { PlusIcon, SearchIcon } from "@/components/icons";
import type { ProjectStatus } from "@/types";
import { cn } from "@/lib/cn";

export type StatusFilter = ProjectStatus | "all";

interface Props {
  filter: StatusFilter;
  setFilter: (s: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
  q: string;
  setQ: (s: string) => void;
  onCreate: () => void;
}

export function DashboardToolbar({ filter, setFilter, counts, q, setQ, onCreate }: Props) {
  return (
    <div className="controls">
      <div className="segmented">
        <button className={cn(filter === "all" && "active")} onClick={() => setFilter("all")}>
          全部
        </button>
        <button className={cn(filter === "draft" && "active")} onClick={() => setFilter("draft")}>
          草稿 · {counts.draft}
        </button>
        <button className={cn(filter === "done" && "active")} onClick={() => setFilter("done")}>
          已生成 · {counts.done}
        </button>
        <button className={cn(filter === "gen" && "active")} onClick={() => setFilter("gen")}>
          生成中 · {counts.gen}
        </button>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          width: 220,
        }}
      >
        <SearchIcon />
        <input
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 13 }}
          placeholder="搜索项目…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <button className="btn-primary btn" onClick={onCreate}>
        <PlusIcon /> 新建项目
      </button>
    </div>
  );
}
