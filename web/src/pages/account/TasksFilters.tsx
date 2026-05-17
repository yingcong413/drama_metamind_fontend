import { SearchIcon } from "@/components/icons";
import type { TaskStatus } from "@/types";

export interface TaskFilters {
  date_from: string;
  date_to: string;
  task_id: string;
  status: TaskStatus | "all";
  resolution: "720p" | "1080p" | "all";
}

interface Props {
  filters: TaskFilters;
  setFilters: (f: TaskFilters) => void;
}

export function TasksFilters({ filters, setFilters }: Props) {
  const reset = () =>
    setFilters({ date_from: "", date_to: "", task_id: "", status: "all", resolution: "all" });
  return (
    <div className="tasks-filters">
      <div className="tasks-filter-row">
        <div className="tasks-filter date">
          <span className="dim-2 mono" style={{ fontSize: 10 }}>提交时间</span>
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
          <span className="dim-2 mono" style={{ fontSize: 10 }}>任务 ID</span>
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
          <span className="dim-2 mono" style={{ fontSize: 10 }}>状态</span>
          <select
            className="select"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as TaskFilters["status"] })}
          >
            <option value="all">全部</option>
            <option value="success">成功</option>
            <option value="running">进行中</option>
            <option value="queued">排队中</option>
            <option value="failed">失败</option>
          </select>
        </div>
        <div className="tasks-filter">
          <span className="dim-2 mono" style={{ fontSize: 10 }}>清晰度</span>
          <select
            className="select"
            value={filters.resolution}
            onChange={(e) =>
              setFilters({ ...filters, resolution: e.target.value as TaskFilters["resolution"] })
            }
          >
            <option value="all">全部</option>
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
          </select>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-sm" onClick={reset}>重置</button>
          <button className="btn btn-primary btn-sm">查询</button>
        </div>
      </div>
    </div>
  );
}
