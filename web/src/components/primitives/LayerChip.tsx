import { useT } from "@/lib/i18n";

export type LayerKind = "global" | "shot" | "output";

interface Props {
  layer: LayerKind;
}

const MAP: Record<LayerKind, { label: string; num: string }> = {
  global: { label: "全局场景层", num: "1–6" },
  shot: { label: "分镜层", num: "7–14" },
  output: { label: "全局输出层", num: "15–17" },
};

export function LayerChip({ layer }: Props) {
  const t = useT();
  const m = MAP[layer];
  return (
    <span className={`layer-chip ${layer}`}>
      <span className="swatch" />
      {t(m.label)} · <span className="mono" style={{ opacity: 0.7 }}>{m.num}</span>
    </span>
  );
}
