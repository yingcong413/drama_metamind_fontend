import { CheckIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import type { TaskStatus } from "@/types";

interface Props {
  status: TaskStatus;
}

export function StatusBadge({ status }: Props) {
  const t = useT();
  if (status === "success")
    return (
      <span className="status-badge success">
        <CheckIcon /> {t("成功")}
      </span>
    );
  if (status === "running")
    return (
      <span className="status-badge running">
        <span className="pulse-dot" /> {t("进行中")}
      </span>
    );
  if (status === "queued") return <span className="status-badge queued">{t("排队中")}</span>;
  return <span className="status-badge failed">{t("失败")}</span>;
}
