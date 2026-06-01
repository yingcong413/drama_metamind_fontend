import { CheckIcon } from "@/components/icons";
import { formatDateTime, formatYuanInt } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { RechargeRecord } from "@/types";

interface Props {
  records: RechargeRecord[];
}

export function RechargesTable({ records }: Props) {
  const t = useT();
  return (
    <div className="tasks-table-wrap">
      <div className="recharges-table">
        <div className="recharges-thead">
          <div>{t("时间")}</div>
          <div>{t("支付方式")}</div>
          <div>{t("充值金额")}</div>
          <div>{t("状态")}</div>
          <div />
        </div>
        {records.map((r) => (
          <div key={r.id} className="recharges-row">
            <div className="mono">{formatDateTime(r.time)}</div>
            <div>{r.method}</div>
            <div className="mono" style={{ fontWeight: 600 }}>
              <span className="dim-2">¥</span> {formatYuanInt(r.amount_cents)}.00
            </div>
            <div>
              <span className="status-badge success">
                <CheckIcon /> {t("成功")}
              </span>
            </div>
            <div>
              <button className="btn-link">{t("下载发票")}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
