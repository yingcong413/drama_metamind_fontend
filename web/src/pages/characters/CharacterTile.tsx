import { CopyIcon, EditIcon, TrashIcon } from "@/components/icons";
import { Portrait } from "./Portrait";
import type { Character } from "@/types";
import { useT, useTf } from "@/lib/i18n";

interface Props {
  character: Character;
  onEdit: () => void;
  onDelete: () => void;
}

export function CharacterTile({ character: c, onEdit, onDelete }: Props) {
  const t = useT();
  const tf = useTf();
  const counts = c.asset_bundle?.counts ?? { image: 0, video: 0, audio: 0 };
  const processing = c.asset_bundle?.processing_count ?? 0;
  const failed = c.asset_bundle?.failed_count ?? 0;
  const hasAnyAsset = counts.image + counts.video + counts.audio > 0;

  return (
    <article className="char-tile" onClick={onEdit}>
      <div className="char-tile-portrait">
        <Portrait char={c} />
        <div className="char-tile-id mono">{c.id.toUpperCase()}</div>
        {hasAnyAsset ? (
          <span className="char-tile-flag flag-ref">
            {countsLabel(counts, tf)}
          </span>
        ) : (
          <span className="char-tile-flag flag-noref">{t("无素材")}</span>
        )}
        {/* v0.7：processing/failed 角标 */}
        {(processing > 0 || failed > 0) && (
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              display: "flex",
              gap: 4,
            }}
          >
            {processing > 0 && (
              <span
                title={tf("{n} 个素材校验中", { n: processing })}
                style={{
                  background: "#DBEAFE",
                  color: "#1E40AF",
                  fontSize: 10,
                  padding: "2px 6px",
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "#1E40AF",
                    animation: "pulse 1.4s ease-in-out infinite",
                  }}
                />
                {processing}
              </span>
            )}
            {failed > 0 && (
              <span
                title={tf("{n} 个素材失败", { n: failed })}
                style={{
                  background: "#FEE2E2",
                  color: "#991B1B",
                  fontSize: 10,
                  padding: "2px 6px",
                  borderRadius: 999,
                }}
              >
                ⚠ {failed}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="char-tile-body">
        <div className="char-tile-name-row">
          <span className="char-tile-name">{c.name}</span>
          <span className="char-tile-role">{c.role}</span>
        </div>
        <p className="char-tile-desc">{c.desc}</p>
        <div className="char-tile-tags">
          {c.tags?.map((t, i) => <span key={i} className="micro-tag">{t}</span>)}
        </div>
        <div className="char-tile-actions">
          <button
            className="btn btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <EditIcon /> {t("编辑")}
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={(e) => e.stopPropagation()}
            title={t("复制")}
          >
            <CopyIcon />
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title={t("删除")}
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </article>
  );
}

function countsLabel(
  counts: { image: number; video: number; audio: number },
  tf: (zh: string, vars: Record<string, string | number>) => string,
): string {
  const parts: string[] = [];
  if (counts.image > 0) parts.push(tf("图 {n}", { n: counts.image }));
  if (counts.video > 0) parts.push(tf("视频 {n}", { n: counts.video }));
  if (counts.audio > 0) parts.push(tf("音 {n}", { n: counts.audio }));
  return parts.join(" · ");
}
