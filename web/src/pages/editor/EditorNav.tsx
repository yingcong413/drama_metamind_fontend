import { ChevronIcon, CheckIcon, CopyIcon, DragIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { FIELD_DEFS } from "@/lib/fieldDefs";
import { isFilled, isOutputFilled, isShotFilled } from "@/lib/validators";
import type { Project } from "@/types";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";

interface Props {
  project: Project;
  activeKey: string;
  activeShot: string;
  scrollAnchor: string | null;
  globalCollapsed: boolean;
  shotsCollapsed: boolean;
  toggleGlobal: () => void;
  toggleShots: () => void;
  selectGlobal: (anchor?: string | null) => void;
  selectShot: (id: string, anchor?: string | null) => void;
  duplicateShot: (id: string) => void;
  deleteShot: (id: string) => void;
  addShot: () => void;
}

export function EditorNav(p: Props) {
  const { project, activeKey, scrollAnchor } = p;
  const t = useT();

  const isGlobalFieldFilled = (id: string, dataLayer: "global" | "output" | undefined) => {
    if (dataLayer === "output") return isOutputFilled(project.output, id);
    return isFilled(project.global, id);
  };

  return (
    <aside className="nav">
      <div style={{ padding: "16px 16px 4px" }}>
        <input className="input" placeholder={t("跳转到字段…")} style={{ padding: "6px 10px", fontSize: 12 }} />
      </div>

      <div
        className={cn("tree-section global", p.globalCollapsed && "collapsed")}
        onClick={p.toggleGlobal}
      >
        <span className="chev"><ChevronIcon /></span>
        <span className="swatch" />
        <span>{t("全局场景层")}</span>
      </div>
      {!p.globalCollapsed && FIELD_DEFS.global.map((f) => {
        const filled = isGlobalFieldFilled(f.id, f.dataLayer);
        const required = f.tags.includes("req");
        const isActive = activeKey === "global" && scrollAnchor === "g-" + f.id;
        return (
          <div
            key={f.id}
            className={cn("tree-item", isActive && "active")}
            onClick={() => p.selectGlobal("g-" + f.id)}
          >
            <span className="num">{f.num}</span>
            <span>{t(f.title)}</span>
            {required && !filled
              ? <span className="req" />
              : filled ? <CheckIcon className="icon done" /> : null}
          </div>
        );
      })}

      <div
        className={cn("tree-section shot", p.shotsCollapsed && "collapsed")}
        onClick={p.toggleShots}
        style={{ marginTop: 12 }}
      >
        <span className="chev"><ChevronIcon /></span>
        <span className="swatch" />
        <span>{t("分镜层")}</span>
        <span className="count">×{project.shots.length}</span>
      </div>
      {!p.shotsCollapsed && project.shots.map((s, i) => {
        const isActiveShot = activeKey === "shot:" + s.id;
        return (
          <div key={s.id} className={cn("tree-group", !isActiveShot && "collapsed")}>
            <div
              className={cn("tree-group-header", isActiveShot && "active")}
              onClick={() => p.selectShot(s.id)}
            >
              <span
                className="chev"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isActiveShot) p.selectShot(s.id);
                }}
              >
                <ChevronIcon />
              </span>
              <span className="num">{t("分镜")} {String(i + 1).padStart(2, "0")}</span>
              <span className="name">{t(s.name)}</span>
              <button className="icon-btn" onClick={(e) => { e.stopPropagation(); p.duplicateShot(s.id); }} title={t("复制")}><CopyIcon /></button>
              <button className="icon-btn" onClick={(e) => e.stopPropagation()} title={t("拖拽排序")}><DragIcon /></button>
              <button className="icon-btn danger" onClick={(e) => { e.stopPropagation(); p.deleteShot(s.id); }} title={t("删除")}><TrashIcon /></button>
            </div>
            {isActiveShot && (
              <div className="tree-group-children">
                {FIELD_DEFS.shot.map((f) => {
                  const filled = isShotFilled(s, f.id);
                  const required = f.tags.includes("req");
                  const anchor = "s-" + s.id + "-" + f.id;
                  return (
                    <div
                      key={f.id}
                      className="tree-item"
                      style={{ paddingLeft: 20 }}
                      onClick={() => p.selectShot(s.id, anchor)}
                    >
                      <span className="num">{f.num}</span>
                      <span>{t(f.title)}</span>
                      {required && !filled
                        ? <span className="req" />
                        : filled ? <CheckIcon className="icon done" /> : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <div className="add-shot" onClick={p.addShot}>
        <PlusIcon /> {t("添加分镜")}
      </div>
      <div style={{ height: 24 }} />
    </aside>
  );
}
