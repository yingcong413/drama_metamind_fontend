import { CloseIcon } from "@/components/icons";
import {
  CAMERA_MOVES, CAMERA_TIER_LABEL,
  DIR_OPTS, MAGNITUDE_OPTS, SPEED_OPTS,
  type CameraMoveMeta,
} from "@/lib/fieldDefs";
import { cn } from "@/lib/cn";
import { useT, useTf } from "@/lib/i18n";
import type { CameraMove, CameraMoveId, Shot } from "@/types";

interface Props {
  value: Shot;
  set: (s: Shot) => void;
}

type Tier = keyof typeof CAMERA_MOVES;

function findMoveMeta(id: string): (CameraMoveMeta & { tier: Tier }) | null {
  for (const tier of Object.keys(CAMERA_MOVES) as Tier[]) {
    const found = CAMERA_MOVES[tier].find((m) => m.id === id);
    if (found) return { ...found, tier };
  }
  return null;
}

export function FCamera({ value, set }: Props) {
  const t = useT();
  const tf = useTf();
  const moves = value.camera ?? [];
  const selectedIds = new Set(moves.map((m) => m.id));

  const toggle = (id: CameraMoveId) => {
    if (selectedIds.has(id)) {
      set({ ...value, camera: [] });
    } else {
      set({
        ...value,
        camera: [{ id, speed: "中", magnitude: "中", direction: null }],
      });
    }
  };
  const updateMove = (id: CameraMoveId, patch: Partial<CameraMove>) => {
    set({
      ...value,
      camera: moves.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {(Object.keys(CAMERA_MOVES) as Tier[]).map((tier) => (
        <div key={tier}>
          <div className="cam-tier-head">
            <span>{t(CAMERA_TIER_LABEL[tier])}</span>
            <span className="dim-2 mono" style={{ fontSize: 10 }}>
              {tf("{n} 种", { n: CAMERA_MOVES[tier].length })}
            </span>
          </div>
          <div className="cam-grid">
            {CAMERA_MOVES[tier].map((m) => {
              const sel = selectedIds.has(m.id as CameraMoveId);
              return (
                <button
                  key={m.id}
                  className={cn("cam-chip", sel && "selected", `tier-${tier}`)}
                  onClick={() => toggle(m.id as CameraMoveId)}
                >
                  <span className="cam-chip-cn">{t(m.cn)}</span>
                  <span className="cam-chip-en">{m.en}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {moves.length > 0 && (
        <div className="cam-params">
          <div
            className="dim-2 mono"
            style={{
              fontSize: 11, letterSpacing: ".05em",
              textTransform: "uppercase", marginBottom: 10,
            }}
          >
{t("已选运镜 · 调整参数")}
          </div>
          {moves.map((m) => {
            const meta = findMoveMeta(m.id);
            if (!meta) return null;
            return (
              <div key={m.id} className="cam-param-row">
                <div className="cam-param-name">
                  <span className={`cam-chip-dot tier-${meta.tier}`} />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{t(meta.cn)}</span>
                  <span className="dim-2 mono" style={{ fontSize: 10 }}>{meta.en}</span>
                  <button
                    className="btn-ghost btn-sm"
                    style={{ marginLeft: "auto", padding: "2px 4px" }}
                    onClick={() => toggle(m.id)}
                  >
                    <CloseIcon />
                  </button>
                </div>
                <div className="cam-param-controls">
                  <div className="cam-param-group">
                    <span className="cam-param-label">{t("速度")}</span>
                    <div className="segmented">
                      {SPEED_OPTS.map((o) => (
                        <button
                          key={o}
                          className={cn(m.speed === o && "active")}
                          onClick={() => updateMove(m.id, { speed: o })}
                        >
                          {t(o)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="cam-param-group">
                    <span className="cam-param-label">{t("幅度")}</span>
                    <div className="segmented">
                      {MAGNITUDE_OPTS.map((o) => (
                        <button
                          key={o}
                          className={cn(m.magnitude === o && "active")}
                          onClick={() => updateMove(m.id, { magnitude: o })}
                        >
                          {t(o)}
                        </button>
                      ))}
                    </div>
                  </div>
                  {meta.needsDir && (
                    <div className="cam-param-group">
                      <span className="cam-param-label">{t("方向")}</span>
                      <div className="segmented">
                        {DIR_OPTS.map((o) => (
                          <button
                            key={o}
                            className={cn(m.direction === o && "active")}
                            onClick={() => updateMove(m.id, { direction: o })}
                          >
                            {t(o)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
