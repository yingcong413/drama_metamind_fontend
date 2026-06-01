import { cn } from "@/lib/cn";
import { useT, useTf } from "@/lib/i18n";

interface Props {
  page: number;
  pageSize: number;
  totalFiltered: number;
  totalAll: number;
  setPage: (p: number) => void;
}

export function TasksPagination({ page, pageSize, totalFiltered, totalAll, setPage }: Props) {
  const t = useT();
  const tf = useTf();
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  return (
    <div className="tasks-pagination">
      <div className="dim-2 mono" style={{ fontSize: 11 }}>
        {tf("显示 {from}–{to} 条 / 共 {total} 条", {
          from: (page - 1) * pageSize + 1,
          to: Math.min(page * pageSize, totalFiltered),
          total: totalFiltered,
        })}
        {totalFiltered !== totalAll && <span> {tf("· 已筛选自 {total} 条", { total: totalAll })}</span>}
      </div>
      <div className="pager">
        <button
          className="btn btn-sm"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          {t("← 上一页")}
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
          {t("下一页 →")}
        </button>
      </div>
    </div>
  );
}
