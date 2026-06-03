import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CloseIcon } from "@/components/icons";
import { Avatar } from "@/components/primitives/Avatar";
import { Field } from "@/components/primitives/Field";
import { Placeholder } from "@/components/primitives/Placeholder";
import { Upload } from "@/components/primitives/Upload";
import { ZoomableImage } from "@/components/primitives/ZoomableImage";
import { avatarHue } from "@/lib/avatarHue";
import { isLoadableUrl } from "@/lib/format";
import { uploadLibraryImage } from "@/lib/uploadLibraryImage";
import { useT, useTf } from "@/lib/i18n";
import type { MediaLibraryConfig } from "./MediaLibrary";
import type { MediaItem } from "./types";

interface Props {
  config: MediaLibraryConfig;
  item: MediaItem | null;
  isNew: boolean;
  onClose: () => void;
}

export function MediaLibraryDrawer({ config, item, isNew, onClose }: Props) {
  const t = useT();
  const tf = useTf();
  const qc = useQueryClient();

  const [name, setName] = useState(item?.name ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(item?.image_url ?? null);
  const [uploading, setUploading] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: [config.queryKey] });

  const create = useMutation({
    mutationFn: () =>
      config.create({ name: name.trim(), image_url: imageUrl, hue: avatarHue(name) }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  const update = useMutation({
    mutationFn: () =>
      config.update(item!.id, { name: name.trim(), image_url: imageUrl }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  const pending = create.isPending || update.isPending || uploading;

  const applyFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadLibraryImage(file, config.uploadPrefix);
      setImageUrl(url);
    } catch (e) {
      console.error("上传参考图失败", e);
      alert(t("上传参考图失败:") + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploading(false);
    }
  };

  const canSubmit = !!name.trim() && !!imageUrl;

  const submit = () => {
    if (!canSubmit) return;
    if (isNew) create.mutate();
    else update.mutate();
  };

  const canRender = !!imageUrl && isLoadableUrl(imageUrl);

  return (
    <>
      <div className="drawer-mask" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <Avatar name={name || "?"} size="lg" />
          <h2>{isNew ? t(config.createLabel) : tf("编辑 · {name}", { name: item?.name ?? "" })}</h2>
          <button className="btn-ghost btn-icon" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="drawer-body">
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Field title={t(config.nameLabel)} tags={["req"]}>
              <input
                className="input input-lg"
                placeholder={t(config.namePlaceholder)}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>

            <Field title={t("参考图")} tags={["req", "upload"]}>
              {imageUrl ? (
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: 12,
                    background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8,
                  }}
                >
                  <div
                    className="thumb"
                    style={{ width: 110, flexShrink: 0, aspectRatio: "4/3", borderRadius: 6, overflow: "hidden" }}
                  >
                    {canRender ? (
                      <ZoomableImage
                        src={imageUrl}
                        alt={name}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <Placeholder label={name} />
                    )}
                  </div>
                  <div style={{ flex: 1 }} />
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => setImageUrl(null)}
                    disabled={pending}
                  >
                    {t("移除")}
                  </button>
                </div>
              ) : (
                <Upload
                  label={uploading ? t("正在上传…") : t("拖拽或点击上传参考图")}
                  onSelect={applyFile}
                />
              )}
            </Field>
          </div>
        </div>
        <div className="drawer-foot">
          <button className="btn" onClick={onClose} disabled={pending}>
            {t("取消")}
          </button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={pending || !canSubmit}
          >
            {pending ? t("保存中…") : isNew ? t("创建") : t("保存")}
          </button>
        </div>
      </div>
    </>
  );
}
