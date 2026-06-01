import { useT } from "@/lib/i18n";

interface Props {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  hint?: string;
}

export function StrengthSlider({
  value,
  onChange,
  label,
  hint,
}: Props) {
  const t = useT();
  const labelText = label ?? t("强度");
  const hintText = hint ?? t("建议 60% – 70%");
  return (
    <div className="strength">
      <div className="strength-head">
        <span
          className="dim-2"
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em",
          }}
        >
          {labelText}
        </span>
        <span className="strength-val mono">{value}%</span>
      </div>
      <input
        className="strength-range"
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--pct" as string]: `${value}%` }}
      />
      {hintText && (
        <div className="dim-2" style={{ fontSize: 11, marginTop: 6 }}>
          {hintText}
        </div>
      )}
    </div>
  );
}
