import { useT } from "@/lib/i18n";

interface Props {
  label?: string;
}

export function Placeholder({ label }: Props) {
  const t = useT();
  return <div className="placeholder-img">{label ?? t("图像占位")}</div>;
}
