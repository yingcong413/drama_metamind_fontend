import { CheckIcon } from "@/components/icons";
import type { TaskStatus } from "@/types";

interface Props {
  status: TaskStatus;
}

export function StatusBadge({ status }: Props) {
  if (status === "success")
    return (
      <span className="status-badge success">
        <CheckIcon /> 成功
      </span>
    );
  if (status === "running")
    return (
      <span className="status-badge running">
        <span className="pulse-dot" /> 进行中
      </span>
    );
  if (status === "queued") return <span className="status-badge queued">排队中</span>;
  return <span className="status-badge failed">失败</span>;
}
