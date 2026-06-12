import type { CSSProperties } from "react";
import { CheckIcon, SearchIcon } from "@/components/icons";
import { avatarHue } from "@/lib/avatarHue";
import { useT } from "@/lib/i18n";
import type { Character, Shot } from "@/types";

interface Props {
  value: Shot;
  set: (s: Shot) => void;
  projectChars: string[];
  characters: Character[];
  onJumpToField5: () => void;
}

export function FShotCast({ value, set, projectChars, characters, onJumpToField5 }: Props) {
  const t = useT();
  const cast = value.cast_ids ?? [];
  const available = (projectChars ?? [])
    .map((id) => characters.find((c) => c.id === id))
    .filter((c): c is Character => !!c);
  const toggle = (id: string) => {
    const s = new Set(cast);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    set({ ...value, cast_ids: [...s] });
  };

  if (available.length === 0) {
    return (
      <div className="empty-cast">
        <div className="empty-cast-icon"><SearchIcon /></div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{t("本剧还未指定任何角色")}</div>
          <div className="dim" style={{ fontSize: 12 }}>
            {t("请先在「全局 · 字段 07 · 角色调用」中选择本剧涉及的角色，再回到这里指派本分镜出场角色。")}
          </div>
        </div>
        <button
          className="btn btn-sm"
          onClick={onJumpToField5}
          style={{ marginLeft: "auto", flexShrink: 0 }}
        >
          {t("前往字段 07 →")}
        </button>
      </div>
    );
  }

  return (
    <div className="shot-cast">
      <div className="shot-cast-grid">
        {available.map((c) => {
          const sel = cast.includes(c.id);
          return (
            <button
              key={c.id}
              className={`shot-cast-card ${sel ? "selected" : ""}`}
              onClick={() => toggle(c.id)}
            >
              <div
                className="shot-cast-portrait"
                style={{ "--ph": c.hue || avatarHue(c.name) } as CSSProperties}
              >
                {c.name.slice(0, 1)}
                {sel && <span className="shot-cast-check"><CheckIcon /></span>}
              </div>
              <div
                style={{
                  display: "flex", flexDirection: "column", gap: 1,
                  textAlign: "left", flex: 1, minWidth: 0,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                <span className="dim-2" style={{ fontSize: 11 }}>{c.role}</span>
              </div>
            </button>
          );
        })}
      </div>
      {cast.length === 0 && (
        <div className="dim-2" style={{ fontSize: 11, marginTop: 8, fontFamily: "var(--font-mono)" }}>
          {t("未选择则视作群像 / 空镜，无具体角色出场")}
        </div>
      )}
    </div>
  );
}
