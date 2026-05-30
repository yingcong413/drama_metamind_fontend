// TasksStatsBar.tsx —— PRD v0.9 §10.6 企业 Owner 全公司任务汇总条
//
// 仅在「全公司」tab 显示。展示:
//   · 本时间窗组织消耗:¥xxx · N 名提交人 · M 条任务(按状态分布)
//   · TOP 提交人(按消费倒序前 5):点击姓名→把 cast_user_id 套到筛选器

import { formatYuan } from "@/lib/format";
import type { TaskStats } from "@/api/tasks";

interface Props {
  stats: TaskStats;
  onPickSubmitter: (userId: string) => void;
  currentSubmitter?: string;
  onClearSubmitter: () => void;
}

export function TasksStatsBar({
  stats,
  onPickSubmitter,
  currentSubmitter,
  onClearSubmitter,
}: Props) {
  const top = stats.top_submitters || [];

  return (
    <section
      style={{
        padding: 14,
        marginBottom: 14,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* 第一行:汇总数字 */}
      <div
        style={{
          display: "flex",
          gap: 28,
          flexWrap: "wrap",
          alignItems: "baseline",
        }}
      >
        <Metric
          label="组织消耗"
          value={`¥ ${formatYuan(stats.total_cost_cents)}`}
          highlight
        />
        <Metric label="提交人" value={`${stats.active_members} 人`} />
        <Metric label="任务总数" value={String(stats.total_count)} />
        <Metric
          label="状态分布"
          value={
            <span
              className="mono"
              style={{
                display: "inline-flex",
                gap: 8,
                fontSize: 12,
              }}
            >
              <span style={{ color: "oklch(70% .15 145)" }}>
                ✓ {stats.by_status.success}
              </span>
              <span style={{ color: "oklch(72% .15 25)" }}>
                ✗ {stats.by_status.failed}
              </span>
              <span style={{ color: "var(--accent, #6aa0ff)" }}>
                ⋯ {stats.by_status.running + stats.by_status.queued}
              </span>
            </span>
          }
        />
      </div>

      {/* 第二行:TOP 提交人 */}
      {top.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            paddingTop: 10,
            borderTop: "1px solid var(--border)",
          }}
        >
          <div
            className="dim-2 mono"
            style={{
              fontSize: 10,
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            TOP 提交人
          </div>
          {top.map((s) => {
            const active = currentSubmitter === s.user_id;
            return (
              <button
                key={s.user_id}
                onClick={() => onPickSubmitter(s.user_id)}
                title={`本时间窗共 ${s.count} 条,消耗 ¥${formatYuan(s.cost_cents)}`}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  background: active ? "var(--accent, #6aa0ff)" : "var(--surface)",
                  color: active ? "white" : "var(--text)",
                  border: "1px solid",
                  borderColor: active ? "var(--accent, #6aa0ff)" : "var(--border)",
                  borderRadius: 16,
                  cursor: "pointer",
                  fontWeight: active ? 600 : 400,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{s.name}</span>
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    opacity: 0.7,
                  }}
                >
                  {s.count}
                </span>
              </button>
            );
          })}
          {currentSubmitter && (
            <button
              className="btn-ghost btn-sm"
              onClick={onClearSubmitter}
              style={{ fontSize: 11, padding: "3px 8px" }}
            >
              × 取消筛选
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div
        className="dim-2 mono"
        style={{
          fontSize: 10,
          letterSpacing: ".08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        className="mono"
        style={{
          fontSize: highlight ? 22 : 16,
          fontWeight: highlight ? 600 : 500,
          color: highlight ? "var(--accent, #6aa0ff)" : "var(--text)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
