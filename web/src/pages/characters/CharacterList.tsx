import { CopyIcon, EditIcon, TrashIcon } from "@/components/icons";
import { ZoomableImage } from "@/components/primitives/ZoomableImage";
import { characterImage } from "@/lib/characterImage";
import { Portrait } from "./Portrait";
import type { Character } from "@/types";
import { useT } from "@/lib/i18n";

interface Props {
  characters: Character[];
  onEdit: (c: Character) => void;
  onDelete: (c: Character) => void;
}

export function CharacterList({ characters, onEdit, onDelete }: Props) {
  const t = useT();
  return (
    <div className="char-list">
      <div className="char-list-head">
        <span className="char-list-cell name">{t("角色")}</span>
        <span className="char-list-cell role">{t("定位")}</span>
        <span className="char-list-cell desc">{t("描述")}</span>
        <span className="char-list-cell tags">{t("标签")}</span>
        <span className="char-list-cell ref">{t("参考图")}</span>
        <span className="char-list-cell actions" />
      </div>
      {characters.map((c) => {
        const img = characterImage(c);
        return (
        <div key={c.id} className="char-list-row" onClick={() => onEdit(c)}>
          <div className="char-list-cell name">
            <div className="char-list-portrait">
              {img ? (
                <ZoomableImage
                  src={img}
                  alt={c.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <Portrait char={c} />
              )}
            </div>
            <span style={{ fontWeight: 600 }}>{c.name}</span>
          </div>
          <div className="char-list-cell role">
            <span className="micro-tag">{c.role}</span>
          </div>
          <div className="char-list-cell desc dim">{c.desc}</div>
          <div className="char-list-cell tags">
            {c.tags?.map((t, i) => <span key={i} className="micro-tag">{t}</span>)}
          </div>
          <div className="char-list-cell ref">
            {c.has_ref ? (
              <span
                className="micro-tag"
                style={{
                  background: "oklch(70% .13 230 / .14)",
                  color: "oklch(75% .13 230)",
                }}
              >
                {t("已绑定")}
              </span>
            ) : (
              <span className="micro-tag">{t("无")}</span>
            )}
          </div>
          <div className="char-list-cell actions">
            <button
              className="btn-ghost btn-icon"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(c);
              }}
            >
              <EditIcon />
            </button>
            <button className="btn-ghost btn-icon" onClick={(e) => e.stopPropagation()}>
              <CopyIcon />
            </button>
            <button
              className="btn-ghost btn-icon"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(c);
              }}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
        );
      })}
    </div>
  );
}
