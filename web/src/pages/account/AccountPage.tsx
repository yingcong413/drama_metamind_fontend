import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { PlusIcon } from "@/components/icons";
import { getAccount, listRecharges } from "@/api/account";
import { exportTasksCsv, getTaskStats, listTasks } from "@/api/tasks";
import { useIsOwner, useAccountType } from "@/stores/auth";
import { cn } from "@/lib/cn";
import { useT, useTf } from "@/lib/i18n";
import { useResumePendingTasks } from "@/lib/useResumePendingTasks";
import type { GenerationTask } from "@/types";
import { AccountInfoCard } from "./AccountInfoCard";
import { BalanceHero } from "./BalanceHero";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { TasksFilters, type TaskFilters } from "./TasksFilters";
import { TasksTable } from "./TasksTable";
import { TasksPagination } from "./TasksPagination";
import { TasksStatsBar } from "./TasksStatsBar";
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
  scope: "mine",
  cast_user_id: undefined,
};

export function AccountPage() {
  const t = useT();
  const tf = useTf();
  const [tab, setTab] = useState<Tab>("tasks");
  const [showRecharge, setShowRecharge] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [previewTask, setPreviewTask] = useState<GenerationTask | null>(null);
  const [filters, setFilters] = useState<TaskFilters>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);

  // PRD v0.9 §1.5.3 + §10.6:企业 Owner 可切「全公司」tab,触发顶部汇总条
  const isOwner = useIsOwner();
  const accountType = useAccountType();
  const canSeeOrgStats = isOwner && accountType === "enterprise" && filters.scope === "all";

  const accountQuery = useQuery({ queryKey: ["account"], queryFn: getAccount });
  const rechargesQuery = useQuery({ queryKey: ["recharges"], queryFn: listRecharges });
  const tasksQuery = useQuery({
    queryKey: ["tasks", filters, page],
    queryFn: () =>
      listTasks({
        scope: filters.scope,
        cast_user_id: filters.cast_user_id,
        status: filters.status,
        resolution: filters.resolution,
        task_id: filters.task_id,
        page,
        page_size: PAGE_SIZE,
      }),
  });
  const allTasksQuery = useQuery({
    queryKey: ["tasks", "count-all"],
    queryFn: () => listTasks({ scope: filters.scope, page_size: 200 }),
    select: (r) => r.total,
  });
  // 关掉生成弹窗后仍在跑的视频任务,在使用记录里续轮询回填结果(否则一直停在 running、看不到视频)
  useResumePendingTasks(tasksQuery.data?.list ?? []);
  // 全公司汇总(仅 Owner + 全公司 tab 才拉)
  const statsQuery = useQuery({
    queryKey: ["task-stats", filters.date_from, filters.date_to],
    queryFn: () =>
      getTaskStats("all", { date_from: filters.date_from, date_to: filters.date_to }),
    enabled: canSeeOrgStats,
  });

  const handleExport = async () => {
    try {
      await exportTasksCsv({
        scope: filters.scope,
        cast_user_id: filters.cast_user_id,
        status: filters.status,
        resolution: filters.resolution,
        task_id: filters.task_id,
        date_from: filters.date_from,
        date_to: filters.date_to,
      });
    } catch (e) {
      alert(tf("导出失败:{msg}", { msg: e instanceof Error ? e.message : String(e) }));
    }
  };

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
        crumbs={[{ label: t("账户与计费") }]}
        actions={
          <button className="btn-primary btn btn-sm" onClick={() => setShowRecharge(true)}>
            <PlusIcon /> {t("充值")}
          </button>
        }
      />
      <div className="account" data-screen-label="Account">
        <AccountInfoCard onChangePassword={() => setShowPwd(true)} />

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
                {t("任务记录")}
                <span className="acc-tab-count mono">{counts.tasks}</span>
              </button>
              <button
                className={cn(tab === "recharges" && "active")}
                onClick={() => setTab("recharges")}
              >
                {t("充值记录")}
                <span className="acc-tab-count mono">{counts.recharges}</span>
              </button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm" onClick={handleExport} disabled={tab !== "tasks"}>
                {t("导出 .csv")}
              </button>
            </div>
          </div>

          {tab === "tasks" ? (
            <>
              {canSeeOrgStats && statsQuery.data && (
                <TasksStatsBar
                  stats={statsQuery.data}
                  onPickSubmitter={(userId) => {
                    setFilters({ ...filters, cast_user_id: userId });
                    setPage(1);
                  }}
                  currentSubmitter={filters.cast_user_id}
                  onClearSubmitter={() => {
                    setFilters({ ...filters, cast_user_id: undefined });
                    setPage(1);
                  }}
                />
              )}
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
      {showPwd && <ChangePasswordDialog onClose={() => setShowPwd(false)} />}
    </>
  );
}
