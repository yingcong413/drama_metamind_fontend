import { useState, type CSSProperties } from "react";
import { CheckIcon, CloseIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { avatarHue } from "@/lib/avatarHue";
import { useT, useTf } from "@/lib/i18n";
import type { Character, GlobalLayer } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
  characters: Character[];
}

export function FCharacters({ value, set, characters }: Props) {
  const t = useT();
  const tf = useTf();
  const [q, setQ] = useState("");
  const selectedIds = value.characters ?? [];
  const toggle = (id: string) => {
    const s = new Set(selectedIds);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    set({ ...value, characters: [...s] });
  };
  const filtered = characters.filter(
    (c) => !q || c.name.includes(q) || c.role?.includes(q) || c.desc?.includes(q),
  );
  const selectedCount = selectedIds.length;

  return (
    <div className="cast-picker">
      <div className="cast-picker-toolbar">
        <div className="cast-search">
          <SearchIcon />
          <input
            placeholder={t("搜索角色名 / 角色定位 / 描述…")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="dim-2 mono" style={{ fontSize: 11 }}>
          {tf("{n} 个角色 · 已选", { n: characters.length })}{" "}
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>{selectedCount}</span>
        </div>
        <button className="btn btn-sm"><PlusIcon /> {t("新建角色")}</button>
      </div>

      <div className="cast-grid">
        {filtered.map((c) => {
          const sel = selectedIds.includes(c.id);
          return (
            <div
              key={c.id}
              className={`cast-card ${sel ? "selected" : ""}`}
              onClick={() => toggle(c.id)}
            >
              <div className="cast-card-portrait">
                <div
                  className="cast-bar-portrait"
                  style={{ width: "100%", height: "100%", borderRadius: 0, fontSize: 32, "--ph": c.hue || avatarHue(c.name) } as CSSProperties}
                >
                  {c.name.slice(0, 1)}
                </div>
                {sel && <div className="cast-card-check"><CheckIcon /></div>}
                {c.has_ref ? (
                  <span className="cast-card-ref-flag">{t("参考图")}</span>
                ) : (
                  <span
                    className="cast-card-ref-flag"
                    style={{ background: "var(--surface-3)", color: "var(--text-tertiary)" }}
                  >
                    {t("无参考")}
                  </span>
                )}
              </div>
              <div className="cast-card-body">
                <div className="cast-card-name-row">
                  <span className="cast-card-name">{c.name}</span>
                  <span className="cast-card-role">{c.role}</span>
                </div>
                <div className="cast-card-desc">{c.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedCount > 0 && (
        <div className="cast-bar">
          <div className="cast-bar-label">
            <span className="dim-2 mono" style={{ fontSize: 11 }}>{t("本剧出场")}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{tf("{n} 个角色", { n: selectedCount })}</span>
          </div>
          <div className="cast-bar-list">
            {selectedIds.map((id) => {
              const c = characters.find((ch) => ch.id === id);
              if (!c) return null;
              return (
                <div key={id} className="cast-bar-chip">
                  <div
                    className="cast-bar-portrait"
                    style={{ "--ph": c.hue || avatarHue(c.name) } as CSSProperties}
                  >
                    {c.name.slice(0, 1)}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</span>
                    <span className="dim-2" style={{ fontSize: 10 }}>{c.role}</span>
                  </div>
                  <button
                    className="btn-ghost btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(id);
                    }}
                    style={{ padding: 2, minWidth: 18 }}
                  >
                    <CloseIcon />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
