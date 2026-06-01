import { StrengthSlider } from "@/components/primitives/StrengthSlider";
import { useT } from "@/lib/i18n";
import type { Shot } from "@/types";

interface Props {
  value: Shot;
  set: (s: Shot) => void;
}

const STEPS = [
  { k: "start", label: "起点", ph: "如：林夏从沙发上起身" },
  { k: "mid",   label: "过程", ph: "如：走向窗边" },
  { k: "end",   label: "结束", ph: "如：推开窗户深呼吸" },
] as const;

export function FAction({ value, set }: Props) {
  const t = useT();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field-row-3">
      {STEPS.map((step, i) => (
        <div key={step.k}>
          <div
            className="dim-2"
            style={{
              fontSize: 11, marginBottom: 6,
              fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <span
              style={{
                background: "var(--layer-shot)", color: "#0B0B0E",
                width: 18, height: 18, borderRadius: 4,
                display: "grid", placeItems: "center", fontWeight: 700,
              }}
            >
              {i + 1}
            </span>
            {t(step.label)}
          </div>
          <textarea
            className="textarea"
            style={{ minHeight: 80 }}
            placeholder={t(step.ph)}
            value={value.action?.[step.k] ?? ""}
            onChange={(e) =>
              set({ ...value, action: { ...value.action, [step.k]: e.target.value } })
            }
          />
        </div>
      ))}
      </div>
      <StrengthSlider
        label={t("动作强度")}
        value={value.action_strength}
        onChange={(v) => set({ ...value, action_strength: v })}
      />
    </div>
  );
}
