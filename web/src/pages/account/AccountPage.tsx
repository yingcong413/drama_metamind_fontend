import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { PlusIcon } from "@/components/icons";
import { getAccount, listRecharges } from "@/api/account";
import { listTasks } from "@/api/tasks";
import { cn } from "@/lib/cn";
import type { GenerationTask } from "@/types";
import { BalanceHero } from "./BalanceHero";
import { TasksFilters, type TaskFilters } from "./TasksFilters";
import { TasksTable } from "./TasksTable";
import { TasksPagination } from "./TasksPagination";
import { RechargesTable } from "./RechargesTable";
import { RechargeDialog } from "./RechargeDialog";
import { VideoPreviewModal } from "./VideoPreviewModal";

type Tab = "tasks" | "recharges";

const PAGE_SIZE = 12;
const INITIAL_FILTERS: TaskFilters = {
  date_from: "2026-05-09 00:00:00",
  date_to: "2026-05-17 18:07:01",
  task_id: "",
  status: "all",
  resolution: "all",
};

export function AccountPage() {
  const [tab, setTab] = useState<Tab>("tasks");
  const [showRecharge, setShowRecharge] = useState(false);
  const [previewTask, setPreviewTask] = useState<GenerationTask | null>(null);
  const [filters, setFilters] = useState<TaskFilters>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);

  const accountQuery = useQuery({ queryKey: ["account"], queryFn: getAccount });
  const rechargesQuery = useQuery({ queryKey: ["recharges"], queryFn: listRecharges });
  const tasksQuery = useQuery({
    queryKey: ["tasks", filters, page],
    queryFn: () =>
      listTasks({
        status: filters.status,
        resolution: filters.resolution,
        task_id: filters.task_id,
        page,
        page_size: PAGE_SIZE,
      }),
  });
  const allTasksQuery = useQuery({
    queryKey: ["tasks", "count-all"],
    queryFn: () => listTasks({ page_size: 200 }),
    select: (r) => r.total,
  });

  const counts = useMemo(
    () => ({
      tasks: allTasksQuery.data ?? 0,
      recharges: rechargesQuery.data?.length ?? 0,
    }),
    [allTasksQuery.data, rechargesQuery.data],
  );

  return (
    <>
      <AppTopBar
        crumbs={[{ label: "账户与计费" }]}
        actions={
          <button className="btn-primary btn btn-sm" onClick={() => setShowRecharge(true)}>
            <PlusIcon /> 充值
          </button>
        }
      />
      <div className="account" data-screen-label="Account">
        {accountQuery.data && (
          <BalanceHero
            account={accountQuery.data}
            onRecharge={() => setShowRecharge(true)}
          />
        )}

        <section className="acc-section">
          <div className="acc-section-head">
            <div className="acc-tabs">
              <button className={cn(tab === "tasks" && "active")} onClick={() => setTab("tasks")}>
                任务记录
                <span className="acc-tab-count mono">{counts.tasks}</span>
              </button>
              <button
                className={cn(tab === "recharges" && "active")}
                onClick={() => setTab("recharges")}
              >
                充值记录
                <span className="acc-tab-count mono">{counts.recharges}</span>
              </button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm">导出 .csv</button>
              <button className="btn btn-sm">列设置</button>
            </div>
          </div>

          {tab === "tasks" ? (
            <>
              <TasksFilters
                filters={filters}
                setFilters={(f) => {
                  setFilters(f);
                  setPage(1);
                }}
              />
              <TasksTable rows={tasksQuery.data?.list ?? []} onPreview={setPreviewTask} />
              <TasksPagination
                page={page}
                pageSize={PAGE_SIZE}
                totalFiltered={tasksQuery.data?.total ?? 0}
                totalAll={allTasksQuery.data ?? 0}
                setPage={setPage}
              />
            </>
          ) : (
            <RechargesTable records={rechargesQuery.data ?? []} />
          )}
        </section>
      </div>

      {showRecharge && accountQuery.data && (
        <RechargeDialog account={accountQuery.data} onClose={() => setShowRecharge(false)} />
      )}
      {previewTask && (
        <VideoPreviewModal task={previewTask} onClose={() => setPreviewTask(null)} />
      )}
    </>
  );
}
