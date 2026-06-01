import { PlusIcon, SearchIcon } from "@/components/icons";
import type { ProjectStatus } from "@/types";
import { cn } from "@/lib/cn";
import { useT, useTf } from "@/lib/i18n";

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
  const t = useT();
  const tf = useTf();
  return (
    <div className="controls">
      <div className="segmented">
        <button className={cn(filter === "all" && "active")} onClick={() => setFilter("all")}>
          {t("全部")}
        </button>
        <button className={cn(filter === "draft" && "active")} onClick={() => setFilter("draft")}>
          {tf("草稿 · {n}", { n: counts.draft })}
        </button>
        <button className={cn(filter === "done" && "active")} onClick={() => setFilter("done")}>
          {tf("已生成 · {n}", { n: counts.done })}
        </button>
        <button className={cn(filter === "gen" && "active")} onClick={() => setFilter("gen")}>
          {tf("生成中 · {n}", { n: counts.gen })}
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
          placeholder={t("搜索项目…")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <button className="btn-primary btn" onClick={onCreate}>
        <PlusIcon /> {t("新建项目")}
      </button>
    </div>
  );
}
