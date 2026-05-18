interface Props {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  hint?: string;
}

export function StrengthSlider({
  value,
  onChange,
  label = "强度",
  hint = "建议 60% – 70%",
}: Props) {
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
          {label}
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
      {hint && (
        <div className="dim-2" style={{ fontSize: 11, marginTop: 6 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
