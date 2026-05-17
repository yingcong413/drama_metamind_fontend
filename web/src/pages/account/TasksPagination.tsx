import { cn } from "@/lib/cn";

interface Props {
  page: number;
  pageSize: number;
  totalFiltered: number;
  totalAll: number;
  setPage: (p: number) => void;
}

export function TasksPagination({ page, pageSize, totalFiltered, totalAll, setPage }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  return (
    <div className="tasks-pagination">
      <div className="dim-2 mono" style={{ fontSize: 11 }}>
        显示 {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalFiltered)} 条 / 共{" "}
        {totalFiltered} 条
        {totalFiltered !== totalAll && <span> · 已筛选自 {totalAll} 条</span>}
      </div>
      <div className="pager">
        <button
          className="btn btn-sm"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          ← 上一页
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .slice(0, 5)
          .map((n) => (
            <button
              key={n}
              className={cn("btn btn-sm", page === n && "active")}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
        {totalPages > 5 && <span className="dim-2 mono">…</span>}
        <button
          className="btn btn-sm"
          disabled={page === totalPages}
          onClick={() => setPage(page + 1)}
        >
          下一页 →
        </button>
      </div>
    </div>
  );
}
