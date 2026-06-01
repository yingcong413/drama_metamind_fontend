import { SearchIcon } from "@/components/icons";
import { useIsOwner, useAccountType } from "@/stores/auth";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";
import type { TaskStatus } from "@/types";

export interface TaskFilters {
  date_from: string;
  date_to: string;
  task_id: string;
  status: TaskStatus | "all";
  resolution: "720p" | "1080p" | "all";
  /** PRD v0.9 §1.5.3:Owner 可在「我的」/「全公司」之间切换;Member 锁死「我的」 */
  scope: "mine" | "all";
  /** PRD v0.9 §10.6:Owner 在全公司视图点 TOP 提交人后,锁到那个人的任务 */
  cast_user_id?: string;
}

interface Props {
  filters: TaskFilters;
  setFilters: (f: TaskFilters) => void;
}

export function TasksFilters({ filters, setFilters }: Props) {
  const t = useT();
  const isOwner = useIsOwner();
  const accountType = useAccountType();
  // 只有企业 Owner 才看到「我的 / 全公司」tab;个人 Owner / Member 都没必要
  const showScopeTab = isOwner && accountType === "enterprise";

  const reset = () =>
    setFilters({
      date_from: "",
      date_to: "",
      task_id: "",
      status: "all",
      resolution: "all",
      scope: showScopeTab ? filters.scope : "mine",
    });
  return (
    <div className="tasks-filters">
      {showScopeTab && (
        <div
          className="segmented"
          style={{ marginBottom: 12, alignSelf: "flex-start" }}
        >
          <button
            type="button"
            className={cn(filters.scope === "mine" && "active")}
            onClick={() => setFilters({ ...filters, scope: "mine" })}
          >
            {t("我的任务")}
          </button>
          <button
            type="button"
            className={cn(filters.scope === "all" && "active")}
            onClick={() => setFilters({ ...filters, scope: "all" })}
          >
            {t("全公司任务")}
          </button>
        </div>
      )}
      <div className="tasks-filter-row">
        <div className="tasks-filter date">
          <span className="dim-2 mono" style={{ fontSize: 10 }}>{t("提交时间")}</span>
          <input
            className="input"
            placeholder="2026-05-09 00:00:00"
            value={filters.date_from}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
          />
          <span className="dim-2">~</span>
          <input
            className="input"
            placeholder="2026-05-17 18:07:01"
            value={filters.date_to}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
          />
        </div>
        <div className="tasks-filter">
          <span className="dim-2 mono" style={{ fontSize: 10 }}>{t("任务 ID")}</span>
          <div className="cast-search" style={{ padding: "5px 10px" }}>
            <SearchIcon />
            <input
              placeholder="task_..."
              value={filters.task_id}
              onChange={(e) => setFilters({ ...filters, task_id: e.target.value })}
            />
          </div>
        </div>
        <div className="tasks-filter">
          <span className="dim-2 mono" style={{ fontSize: 10 }}>{t("状态")}</span>
          <select
            className="select"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as TaskFilters["status"] })}
          >
            <option value="all">{t("全部")}</option>
            <option value="success">{t("成功")}</option>
            <option value="running">{t("进行中")}</option>
            <option value="queued">{t("排队中")}</option>
            <option value="failed">{t("失败")}</option>
          </select>
        </div>
        <div className="tasks-filter">
          <span className="dim-2 mono" style={{ fontSize: 10 }}>{t("清晰度")}</span>
          <select
            className="select"
            value={filters.resolution}
            onChange={(e) =>
              setFilters({ ...filters, resolution: e.target.value as TaskFilters["resolution"] })
            }
          >
            <option value="all">{t("全部")}</option>
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
          </select>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-sm" onClick={reset}>{t("重置")}</button>
          <button className="btn btn-primary btn-sm">{t("查询")}</button>
        </div>
      </div>
    </div>
  );
}
