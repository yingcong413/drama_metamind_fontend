interface Props {
  onClick: () => void;
}

export function NewProjectCard({ onClick }: Props) {
  return (
    <div className="proj-card new-card" onClick={onClick}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "var(--text-tertiary)" }}>
        <div className="plus">+</div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>新建项目</div>
        <div className="dim-2 mono" style={{ fontSize: 10, marginTop: 4 }}>
          从空白开始 · 或从模板
        </div>
      </div>
    </div>
  );
}
