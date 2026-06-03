import { useState, type CSSProperties } from "react";
import { CheckIcon, CloseIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { ZoomButton } from "@/components/primitives/ZoomableImage";
import { avatarHue } from "@/lib/avatarHue";
import { characterImage } from "@/lib/characterImage";
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
    const removing = s.has(id);
    if (removing) s.delete(id);
    else s.add(id);
    // 取消选择时,顺手清掉该角色的变体选择
    let cv = value.character_variants;
    if (removing && cv && id in cv) {
      cv = { ...cv };
      delete cv[id];
    }
    set({ ...value, characters: [...s], character_variants: cv });
  };
  const setVariant = (id: string, vid: string) => {
    const next = { ...(value.character_variants ?? {}) };
    if (vid) next[id] = vid;
    else delete next[id];
    set({ ...value, character_variants: next });
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
          const img = characterImage(c);
          return (
            <div
              key={c.id}
              className={`cast-card ${sel ? "selected" : ""}`}
              onClick={() => toggle(c.id)}
            >
              <div className="cast-card-portrait">
                {img ? (
                  <img
                    src={img}
                    alt={c.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div
                    className="cast-bar-portrait"
                    style={{ width: "100%", height: "100%", borderRadius: 0, fontSize: 32, "--ph": c.hue || avatarHue(c.name) } as CSSProperties}
                  >
                    {c.name.slice(0, 1)}
                  </div>
                )}
                {img && <ZoomButton src={img} alt={c.name} />}
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
                  {c.has_variants && (c.variants?.length ?? 0) > 0 ? (
                    <span className="cast-card-role" style={{ color: "var(--accent)" }}>
                      {tf("{n} 变体", { n: c.variants!.length })}
                    </span>
                  ) : (
                    <span className="cast-card-role">{c.role}</span>
                  )}
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
              const variants = c.has_variants ? c.variants ?? [] : [];
              const curVid = value.character_variants?.[id] ?? "";
              return (
                <div key={id} className="cast-bar-chip">
                  <div
                    className="cast-bar-portrait"
                    style={{ "--ph": c.hue || avatarHue(c.name) } as CSSProperties}
                  >
                    {c.name.slice(0, 1)}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</span>
                    {variants.length > 0 ? (
                      <select
                        className="select"
                        value={curVid}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setVariant(id, e.target.value)}
                        title={t("选择调用该角色的哪个变体")}
                        style={{ fontSize: 11, padding: "1px 4px", height: 22, maxWidth: 140 }}
                      >
                        <option value="">{t("默认（基础形象）")}</option>
                        {variants.map((v, i) => (
                          <option key={v.id} value={v.id}>
                            {v.name || tf("变体 {n}", { n: i + 1 })}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="dim-2" style={{ fontSize: 10 }}>{c.role}</span>
                    )}
                  </div>
                  <button
                    className="btn-ghost btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(id);
                    }}
                    style={{ padding: 2, minWidth: 18, alignSelf: "flex-start" }}
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
