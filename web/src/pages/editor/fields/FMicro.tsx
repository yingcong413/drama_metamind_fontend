import { StrengthSlider } from "@/components/primitives/StrengthSlider";
import { useT } from "@/lib/i18n";
import type { MicroBlock, Shot } from "@/types";

interface Props {
  value: Shot;
  set: (s: Shot) => void;
}

const ROWS: Array<{ k: keyof MicroBlock; label: string; ph: string }> = [
  { k: "eyes",    label: "眼神", ph: "如：微微眯起、回避对视" },
  { k: "look",    label: "神态", ph: "如：略显犹豫、克制紧张" },
  { k: "emotion", label: "情绪", ph: "如：压抑克制、刺痛平静" },
];

export function FMicro({ value, set }: Props) {
  const t = useT();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field-row-3">
      {ROWS.map((r) => (
        <div key={r.k}>
          <div
            className="dim-2"
            style={{
              fontSize: 11, marginBottom: 6,
              fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em",
            }}
          >
            {t(r.label)}
          </div>
          <input
            className="input"
            placeholder={t(r.ph)}
            value={value.micro?.[r.k] ?? ""}
            onChange={(e) => set({ ...value, micro: { ...value.micro, [r.k]: e.target.value } })}
          />
        </div>
      ))}
      </div>
      <StrengthSlider
        label={t("微表情强度")}
        value={value.micro_strength}
        onChange={(v) => set({ ...value, micro_strength: v })}
      />
    </div>
  );
}
