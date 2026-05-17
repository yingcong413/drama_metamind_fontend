import { ChipSelect } from "@/components/primitives/ChipSelect";
import type { GlobalLayer } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
}

export function FTime({ value, set }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div className="field-help" style={{ marginBottom: 8 }}>季节</div>
        <ChipSelect
          options={["春", "夏", "秋", "冬"]}
          value={value.season}
          onChange={(v) => set({ ...value, season: v as GlobalLayer["season"] })}
          layerClass="global"
        />
      </div>
      <div>
        <div className="field-help" style={{ marginBottom: 8 }}>时段</div>
        <ChipSelect
          options={["清晨", "白天", "黄昏", "黑夜"]}
          value={value.time_of_day}
          onChange={(v) => set({ ...value, time_of_day: v as GlobalLayer["time_of_day"] })}
          layerClass="global"
        />
      </div>
    </div>
  );
}
