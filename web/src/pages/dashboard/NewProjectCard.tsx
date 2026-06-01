import { useT } from "@/lib/i18n";

interface Props {
  onClick: () => void;
}

export function NewProjectCard({ onClick }: Props) {
  const t = useT();
  return (
    <div className="proj-card new-card" onClick={onClick}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "var(--text-tertiary)" }}>
        <div className="plus">+</div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{t("新建项目")}</div>
        <div className="dim-2 mono" style={{ fontSize: 10, marginTop: 4 }}>
          {t("从空白开始 · 或从模板")}
        </div>
      </div>
    </div>
  );
}
