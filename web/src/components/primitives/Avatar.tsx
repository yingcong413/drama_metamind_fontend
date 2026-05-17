import type { CSSProperties } from "react";
import { avatarHue } from "@/lib/avatarHue";

interface AvatarProps {
  name: string;
  size?: "md" | "lg" | "xl";
}

export function Avatar({ name, size = "md" }: AvatarProps) {
  const h = avatarHue(name || "?");
  const cls =
    size === "lg" ? "avatar avatar-lg" : size === "xl" ? "avatar avatar-xl" : "avatar";
  const style = { "--ah": h, "--ah2": (h + 60) % 360 } as CSSProperties;
  return (
    <div className={cls} style={style}>
      {(name || "?").slice(0, 1)}
    </div>
  );
}
