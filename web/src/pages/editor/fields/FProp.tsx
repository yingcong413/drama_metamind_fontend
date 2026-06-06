import { useState, type CSSProperties } from "react";
import { CheckIcon, CloseIcon, SearchIcon } from "@/components/icons";
import { ZoomButton } from "@/components/primitives/ZoomableImage";
import { avatarHue } from "@/lib/avatarHue";
import { isLoadableUrl } from "@/lib/format";
import { useT, useTf } from "@/lib/i18n";
import type { GlobalLayer, Prop } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
  props: Prop[];
}

// 写入 props id 数组（多选的真实来源），首项派生进 prop_image_url（向后兼容），
// 并写入每个选中道具的「名字 + 图」快照 prop_refs，供 prompt 按「道具名 + 图」分别体现多道具。
function applySelection(value: GlobalLayer, ids: string[], props: Prop[]): GlobalLayer {
  const primary = ids.length ? props.find((p) => p.id === ids[0]) : null;
  const prop_refs = ids
    .map((id) => props.find((p) => p.id === id))
    .filter((p): p is Prop => !!p)
    .map((p) => ({ name: p.name, image_url: p.image_url ?? null }));
  return { ...value, props: ids, prop_image_url: primary?.image_url ?? null, prop_refs };
}

export function FProp({ value, set, props }: Props) {
  const t = useT();
  const tf = useTf();
  const [q, setQ] = useState("");
  const selectedIds = value.props ?? [];
  const toggle = (id: string) => {
    const s = new Set(selectedIds);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    set(applySelection(value, [...s], props));
  };
  const filtered = props.filter((p) => !q || p.name.includes(q));
  const selectedCount = selectedIds.length;

  return (
    <div className="cast-picker">
      <div className="cast-picker-toolbar">
        <div className="cast-search">
          <SearchIcon />
          <input
            placeholder={t("搜索道具名…")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="dim-2 mono" style={{ fontSize: 11 }}>
          {tf("{n} 个道具 · 已选", { n: props.length })}{" "}
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>{selectedCount}</span>
        </div>
      </div>

      <div className="cast-grid">
        {filtered.map((p) => {
          const sel = selectedIds.includes(p.id);
          const isPrimary = sel && selectedIds[0] === p.id;
          const canRender = !!p.image_url && isLoadableUrl(p.image_url);
          return (
            <div
              key={p.id}
              className={`cast-card ${sel ? "selected" : ""}`}
              onClick={() => toggle(p.id)}
            >
              <div className="cast-card-portrait">
                {canRender ? (
                  <img
                    src={p.image_url as string}
                    alt={p.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div
                    className="cast-bar-portrait"
                    style={{ width: "100%", height: "100%", borderRadius: 0, fontSize: 32, "--ph": p.hue || avatarHue(p.name) } as CSSProperties}
                  >
                    {p.name.slice(0, 1)}
                  </div>
                )}
                {canRender && <ZoomButton src={p.image_url as string} alt={p.name} />}
                {sel && <div className="cast-card-check"><CheckIcon /></div>}
                {isPrimary ? (
                  <span className="cast-card-ref-flag">{t("主道具")}</span>
                ) : p.image_url ? (
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
                  <span className="cast-card-name">{p.name}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedCount > 0 && (
        <div className="cast-bar">
          <div className="cast-bar-label">
            <span className="dim-2 mono" style={{ fontSize: 11 }}>{t("本剧道具")}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{tf("{n} 个道具", { n: selectedCount })}</span>
          </div>
          <div className="cast-bar-list">
            {selectedIds.map((id, idx) => {
              const p = props.find((pr) => pr.id === id);
              if (!p) return null;
              return (
                <div key={id} className="cast-bar-chip">
                  <div
                    className="cast-bar-portrait"
                    style={{ "--ph": p.hue || avatarHue(p.name) } as CSSProperties}
                  >
                    {p.name.slice(0, 1)}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</span>
                    <span className="dim-2" style={{ fontSize: 10 }}>
                      {idx === 0 ? t("主道具") : t("道具")}
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
