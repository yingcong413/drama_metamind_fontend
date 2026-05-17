import { CopyIcon, EditIcon, TrashIcon } from "@/components/icons";
import { Portrait } from "./Portrait";
import type { Character } from "@/types";

interface Props {
  character: Character;
  onEdit: () => void;
  onDelete: () => void;
}

export function CharacterTile({ character: c, onEdit, onDelete }: Props) {
  return (
    <article className="char-tile" onClick={onEdit}>
      <div className="char-tile-portrait">
        <Portrait char={c} />
        <div className="char-tile-id mono">{c.id.toUpperCase()}</div>
        {c.has_ref ? (
          <span className="char-tile-flag flag-ref">已绑定参考图</span>
        ) : (
          <span className="char-tile-flag flag-noref">无参考图</span>
        )}
      </div>
      <div className="char-tile-body">
        <div className="char-tile-name-row">
          <span className="char-tile-name">{c.name}</span>
          <span className="char-tile-role">{c.role}</span>
        </div>
        <p className="char-tile-desc">{c.desc}</p>
        <div className="char-tile-tags">
          {c.tags?.map((t, i) => <span key={i} className="micro-tag">{t}</span>)}
        </div>
        <div className="char-tile-actions">
          <button
            className="btn btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <EditIcon /> 编辑
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={(e) => e.stopPropagation()}
            title="复制"
          >
            <CopyIcon />
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="删除"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </article>
  );
}
