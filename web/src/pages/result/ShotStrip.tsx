import { cn } from "@/lib/cn";
import type { Shot } from "@/types";

interface Props {
  shots: Shot[];
  activeIndex: number;
  onSelect: (i: number) => void;
}

export function ShotStrip({ shots, activeIndex, onSelect }: Props) {
  return (
    <div className="shot-strip">
      {shots.map((s, i) => (
        <div
          key={s.id}
          className={cn("shot", activeIndex === i && "active")}
          style={{
            background: `linear-gradient(135deg, oklch(35% .10 ${(i * 50) % 360}), oklch(20% .08 ${(i * 50 + 60) % 360}))`,
          }}
          onClick={() => onSelect(i)}
        >
          <div className="num mono">{String(i + 1).padStart(2, "0")}</div>
          <div className="dur mono">{(0.6 + i * 0.2).toFixed(1)}s</div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "rgba(255,255,255,.4)",
              fontSize: 10,
              padding: 6,
              textAlign: "center",
            }}
          >
            {s.name}
          </div>
        </div>
      ))}
    </div>
  );
}
