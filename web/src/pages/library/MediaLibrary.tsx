import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { EditIcon, PlusIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { Placeholder } from "@/components/primitives/Placeholder";
import { ZoomButton } from "@/components/primitives/ZoomableImage";
import { cn } from "@/lib/cn";
import { isLoadableUrl } from "@/lib/format";
import { useT, useTf } from "@/lib/i18n";
import { useIsOwner } from "@/stores/auth";
import { MediaLibraryDrawer } from "./MediaLibraryDrawer";
import type { MediaItem, MediaUpsert } from "./types";

export interface MediaLibraryConfig {
  kind: "scene" | "prop";
  queryKey: string;
  list: () => Promise<MediaItem[]>;
  create: (input: MediaUpsert) => Promise<MediaItem>;
  update: (id: string, patch: Partial<MediaUpsert>) => Promise<MediaItem>;
  remove: (id: string) => Promise<void>;
  // 文案
  pageTitle: string;       // 场景库
  enLabel: string;         // Scene Library
  subtitle: string;
  createLabel: string;     // 新建场景
  searchPlaceholder: string;
  uploadPrefix: string;    // TOS 子目录 / fallback 标识
  nameLabel: string;       // 场景名
  namePlaceholder: string;
  confirmDelete: string;   // "确认删除场景「{name}」？此操作不可撤销。"
}

interface Props {
  config: MediaLibraryConfig;
}

export function MediaLibrary({ config }: Props) {
  const t = useT();
  const tf = useTf();
  const qc = useQueryClient();
  // R9 库权限:仅母账号(Owner)可新建 / 编辑 / 删除素材库;子账号(Member)只读 + 引用。
  const isOwner = useIsOwner();
  const { data: items = [], isLoading } = useQuery({
    queryKey: [config.queryKey],
    queryFn: config.list,
  });

  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");

  const del = useMutation({
    mutationFn: (id: string) => config.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [config.queryKey] }),
  });

  const counts = useMemo(
    () => ({
      all: items.length,
      ref: items.filter((s) => !!s.image_url).length,
      noref: items.filter((s) => !s.image_url).length,
    }),
    [items],
  );

  const filtered = useMemo(
    () => items.filter((s) => !q || s.name.includes(q)),
    [items, q],
  );

  const onDelete = (s: MediaItem) => {
    if (confirm(tf(config.confirmDelete, { name: s.name }))) del.mutate(s.id);
  };

  const closeDrawer = () => {
    setEditing(null);
    setCreating(false);
  };

  return (
    <>
      <AppTopBar
        crumbs={[{ label: t(config.pageTitle) }]}
        actions={
          isOwner ? (
            <button className="btn-primary btn btn-sm" onClick={() => setCreating(true)}>
              <PlusIcon /> {t(config.createLabel)}
            </button>
          ) : undefined
        }
      />
      <div className="char-lib" data-screen-label={config.enLabel}>
        <div className="char-lib-hero">
          <div>
            <div
              className="dim-2 mono"
              style={{
                fontSize: 11, letterSpacing: ".1em",
                textTransform: "uppercase", marginBottom: 8,
              }}
            >
              {config.enLabel}
            </div>
            <h1>{t(config.pageTitle)}</h1>
            <p className="char-lib-sub">{t(config.subtitle)}</p>
          </div>
          <div className="char-lib-stats">
            <div className="stat">
              <div className="stat-n mono">{counts.all}</div>
              <div className="stat-l">{t("总数")}</div>
            </div>
            <div className="stat">
              <div className="stat-n mono">{counts.ref}</div>
              <div className="stat-l">{t("已上传图")}</div>
            </div>
            <div className="stat">
              <div className="stat-n mono">{counts.noref}</div>
              <div className="stat-l">{t("无图")}</div>
            </div>
          </div>
        </div>

        <div className="char-lib-toolbar">
          <div className="cast-search" style={{ maxWidth: 280 }}>
            <SearchIcon />
            <input
              placeholder={t(config.searchPlaceholder)}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {!isOwner && (
            <span
              className="dim-2"
              style={{
                fontSize: 12, padding: "4px 10px", borderRadius: 6,
                background: "var(--surface-2)", border: "1px solid var(--border)",
              }}
            >
              {t("素材库由母账号统一管理，你可在工作台中引用，但无法新建或删除。")}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="dim" style={{ padding: 24 }}>{t("加载中…")}</div>
        ) : (
          <div className="char-gallery">
            {filtered.map((s) => (
              <MediaTile
                key={s.id}
                item={s}
                canManage={isOwner}
                onEdit={() => setEditing(s)}
                onDelete={() => onDelete(s)}
              />
            ))}
            {isOwner && (
              <div className="char-tile-add" onClick={() => setCreating(true)}>
                <div className="add-glyph">+</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t(config.createLabel)}</div>
                <div className="dim-2 mono" style={{ fontSize: 10, marginTop: 4 }}>
                  {t("名字 / 参考图")}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {(editing || creating) && (
        <MediaLibraryDrawer
          config={config}
          item={editing}
          isNew={creating}
          onClose={closeDrawer}
        />
      )}
    </>
  );
}

function MediaTile({
  item,
  canManage,
  onEdit,
  onDelete,
}: {
  item: MediaItem;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const canRender = !!item.image_url && isLoadableUrl(item.image_url);
  return (
    <article className="char-tile" onClick={canManage ? onEdit : undefined} style={canManage ? undefined : { cursor: "default" }}>
      <div className="char-tile-portrait">
        {canRender ? (
          <img
            src={item.image_url as string}
            alt={item.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <Placeholder label={item.name} />
        )}
        {canRender && <ZoomButton src={item.image_url as string} alt={item.name} />}
        <div className="char-tile-id mono">{item.id.toUpperCase()}</div>
        <span className={cn("char-tile-flag", item.image_url ? "flag-ref" : "flag-noref")}>
          {item.image_url ? t("已上传图") : t("无图")}
        </span>
      </div>
      <div className="char-tile-body">
        <div className="char-tile-name-row">
          <span className="char-tile-name">{item.name}</span>
        </div>
        {canManage ? (
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
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title={t("删除")}
            >
              <TrashIcon />
            </button>
          </div>
        ) : (
          <div className="char-tile-actions">
            <span className="dim-2" style={{ fontSize: 11 }}>{t("仅可引用")}</span>
          </div>
        )}
      </div>
    </article>
  );
}
