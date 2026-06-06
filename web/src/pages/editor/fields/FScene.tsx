import { useState, type CSSProperties } from "react";
import { CheckIcon, CloseIcon, SearchIcon } from "@/components/icons";
import { ZoomButton } from "@/components/primitives/ZoomableImage";
import { avatarHue } from "@/lib/avatarHue";
import { isLoadableUrl } from "@/lib/format";
import { useT, useTf } from "@/lib/i18n";
import type { GlobalLayer, Scene } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
  scenes: Scene[];
}

// 写入 scenes id 数组（多选的真实来源），首项派生进 scene_image（向后兼容），
// 并写入每个选中场景的「名字 + 图」快照 scene_refs，供 prompt 按名分别体现多场景。
function applySelection(value: GlobalLayer, ids: string[], scenes: Scene[]): GlobalLayer {
  const primary = ids.length ? scenes.find((s) => s.id === ids[0]) : null;
  const scene_refs = ids
    .map((id) => scenes.find((s) => s.id === id))
    .filter((s): s is Scene => !!s)
    .map((s) => ({ name: s.name, image_url: s.image_url ?? null }));
  return { ...value, scenes: ids, scene_image: primary?.image_url ?? null, scene_refs };
}

export function FScene({ value, set, scenes }: Props) {
  const t = useT();
  const tf = useTf();
  const [q, setQ] = useState("");
  const selectedIds = value.scenes ?? [];
  const toggle = (id: string) => {
    const s = new Set(selectedIds);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    set(applySelection(value, [...s], scenes));
  };
  const filtered = scenes.filter((s) => !q || s.name.includes(q));
  const selectedCount = selectedIds.length;

  return (
    <div className="cast-picker">
      <div className="cast-picker-toolbar">
        <div className="cast-search">
          <SearchIcon />
          <input
            placeholder={t("搜索场景名…")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="dim-2 mono" style={{ fontSize: 11 }}>
          {tf("{n} 个场景 · 已选", { n: scenes.length })}{" "}
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>{selectedCount}</span>
        </div>
      </div>

      <div className="cast-grid">
        {filtered.map((s) => {
          const sel = selectedIds.includes(s.id);
          const isPrimary = sel && selectedIds[0] === s.id;
          const canRender = !!s.image_url && isLoadableUrl(s.image_url);
          return (
            <div
              key={s.id}
              className={`cast-card ${sel ? "selected" : ""}`}
              onClick={() => toggle(s.id)}
            >
              <div className="cast-card-portrait">
                {canRender ? (
                  <img
                    src={s.image_url as string}
                    alt={s.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div
                    className="cast-bar-portrait"
                    style={{ width: "100%", height: "100%", borderRadius: 0, fontSize: 32, "--ph": s.hue || avatarHue(s.name) } as CSSProperties}
                  >
                    {s.name.slice(0, 1)}
                  </div>
                )}
                {canRender && <ZoomButton src={s.image_url as string} alt={s.name} />}
                {sel && <div className="cast-card-check"><CheckIcon /></div>}
                {isPrimary ? (
                  <span className="cast-card-ref-flag">{t("主场景")}</span>
                ) : s.image_url ? (
                  <span className="cast-card-ref-flag">{t("参考图")}</span>
                ) : (
                  <span
                    className="cast-card-ref-flag"
                    style={{ background: "var(--surface-3)", color: "var(--text-tertiary)" }}
                  >
                    {t("无图")}
                  </span>
                )}
              </div>
              <div className="cast-card-body">
                <div className="cast-card-name-row">
                  <span className="cast-card-name">{s.name}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedCount > 0 && (
        <div className="cast-bar">
          <div className="cast-bar-label">
            <span className="dim-2 mono" style={{ fontSize: 11 }}>{t("本剧场景")}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{tf("{n} 个场景", { n: selectedCount })}</span>
          </div>
          <div className="cast-bar-list">
            {selectedIds.map((id, idx) => {
              const s = scenes.find((sc) => sc.id === id);
              if (!s) return null;
              return (
                <div key={id} className="cast-bar-chip">
                  <div
                    className="cast-bar-portrait"
                    style={{ "--ph": s.hue || avatarHue(s.name) } as CSSProperties}
                  >
                    {s.name.slice(0, 1)}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</span>
                    <span className="dim-2" style={{ fontSize: 10 }}>
                      {idx === 0 ? t("主场景") : t("场景")}
                    </span>
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
