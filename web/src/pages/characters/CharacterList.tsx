import { CopyIcon, EditIcon, TrashIcon } from "@/components/icons";
import { Portrait } from "./Portrait";
import type { Character } from "@/types";

interface Props {
  characters: Character[];
  onEdit: (c: Character) => void;
  onDelete: (c: Character) => void;
}

export function CharacterList({ characters, onEdit, onDelete }: Props) {
  return (
    <div className="char-list">
      <div className="char-list-head">
        <span className="char-list-cell name">角色</span>
        <span className="char-list-cell role">定位</span>
        <span className="char-list-cell desc">描述</span>
        <span className="char-list-cell tags">标签</span>
        <span className="char-list-cell ref">参考图</span>
        <span className="char-list-cell actions" />
      </div>
      {characters.map((c) => (
        <div key={c.id} className="char-list-row" onClick={() => onEdit(c)}>
          <div className="char-list-cell name">
            <div className="char-list-portrait">
              <Portrait char={c} />
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
                已绑定
              </span>
            ) : (
              <span className="micro-tag">无</span>
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
      ))}
    </div>
  );
}
