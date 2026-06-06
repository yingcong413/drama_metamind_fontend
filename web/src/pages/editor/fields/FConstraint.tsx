import { useT, useTf } from "@/lib/i18n";
import type { GlobalLayer } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

// 「想象力约束强度」滑块(0–100):控制提示词末尾约束措辞的力度。
export function FConstraint({ value, set }: Props) {
  const t = useT();
  const tf = useTf();
  const v = typeof value.constraint_strength === "number" ? value.constraint_strength : 70;
  const level = v < 34 ? t("宽松") : v < 67 ? t("适中") : t("严格");
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={v}
          onChange={(e) => set({ ...value, constraint_strength: Number(e.target.value) })}
          style={{ flex: 1 }}
        />
        <span className="mono" style={{ minWidth: 92, textAlign: "right", fontSize: 13 }}>
          {tf("{n} · {lvl}", { n: v, lvl: level })}
        </span>
      </div>
      <div className="dim-2" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
        {t("越高越严格地只呈现提示词描述的内容、越强地禁止 Seedance 自由发挥(添加未提及的人物/物体/场景/剧情)。默认 70(严格)。")}
      </div>
    </div>
  );
}
