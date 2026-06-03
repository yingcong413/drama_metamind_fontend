import { useState } from "react";
import { CloseIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { Upload } from "@/components/primitives/Upload";
import { ZoomableImage } from "@/components/primitives/ZoomableImage";
import { isLoadableUrl } from "@/lib/format";
import { useT, useTf } from "@/lib/i18n";
import { uploadLibraryMedia } from "@/lib/uploadLibraryImage";
import type { CharacterVariant } from "@/types";

interface Props {
  variants: CharacterVariant[];
  onChange: (v: CharacterVariant[]) => void;
}

let vseq = 0;
const newVariant = (): CharacterVariant => ({
  id: "v_" + Date.now().toString(36) + "_" + vseq++,
  name: "",
  desc: "",
  image_url: null,
  angle_images: [],
  voice_url: null,
});

export function CharacterVariants({ variants, onChange }: Props) {
  const t = useT();
  const tf = useTf();

  const patch = (id: string, p: Partial<CharacterVariant>) =>
    onChange(variants.map((v) => (v.id === id ? { ...v, ...p } : v)));
  const remove = (id: string) => onChange(variants.filter((v) => v.id !== id));
  const add = () => onChange([...variants, newVariant()]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {variants.length === 0 && (
        <div
          className="dim-2"
          style={{
            padding: "12px 14px",
            background: "var(--surface-2)",
            border: "1px dashed var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          {t("还没有变体。点击下方「添加变体」创建第一套造型。")}
        </div>
      )}

      {variants.map((v, i) => (
        <VariantCard
          key={v.id}
          index={i}
          variant={v}
          onPatch={(p) => patch(v.id, p)}
          onRemove={() => {
            if (confirm(tf("确定删除「{name}」？", { name: v.name || t("未命名变体") }))) remove(v.id);
          }}
        />
      ))}

      <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={add}>
        <PlusIcon /> {t("添加变体")}
      </button>
    </div>
  );
}

function VariantCard({
  index,
  variant,
  onPatch,
  onRemove,
}: {
  index: number;
  variant: CharacterVariant;
  onPatch: (p: Partial<CharacterVariant>) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const tf = useTf();
  const [imgBusy, setImgBusy] = useState(false);
  const [angleBusy, setAngleBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);

  const uploadImage = async (file: File) => {
    setImgBusy(true);
    try {
      const url = await uploadLibraryMedia(file, "image", "character_variant_images");
      onPatch({ image_url: url });
    } catch (e) {
      alert(t("上传图片失败:") + (e instanceof Error ? e.message : String(e)));
    } finally {
      setImgBusy(false);
    }
  };

  const uploadAngle = async (file: File) => {
    setAngleBusy(true);
    try {
      const url = await uploadLibraryMedia(file, "image", "character_variant_angles");
      onPatch({ angle_images: [...variant.angle_images, url] });
    } catch (e) {
      alert(t("上传图片失败:") + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAngleBusy(false);
    }
  };

  const uploadVoice = async (file: File) => {
    setVoiceBusy(true);
    try {
      const url = await uploadLibraryMedia(file, "audio", "character_variant_audios");
      onPatch({ voice_url: url });
    } catch (e) {
      alert(t("上传音频失败:") + (e instanceof Error ? e.message : String(e)));
    } finally {
      setVoiceBusy(false);
    }
  };

  const removeAngle = (idx: number) =>
    onPatch({ angle_images: variant.angle_images.filter((_, i) => i !== idx) });

  const label = (s: string) => (
    <div
      className="dim-2 mono"
      style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}
    >
      {s}
    </div>
  );

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 14,
        background: "var(--surface-2)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          className="num-badge global"
          style={{ flexShrink: 0 }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>
          {variant.name || tf("变体 {n}", { n: index + 1 })}
        </span>
        <button className="btn-ghost btn-sm" onClick={onRemove} title={t("删除该变体")}>
          <TrashIcon />
        </button>
      </div>

      <div>
        {label(t("变体名"))}
        <input
          className="input"
          placeholder={t("如：战损版 / 古装造型 / 黑化形态")}
          value={variant.name}
          onChange={(e) => onPatch({ name: e.target.value })}
        />
      </div>

      <div>
        {label(t("变体描述"))}
        <textarea
          className="textarea"
          style={{ minHeight: 70 }}
          placeholder={t("这套造型的外貌、服饰、状态、气质等…")}
          value={variant.desc}
          onChange={(e) => onPatch({ desc: e.target.value })}
        />
      </div>

      <div>
        {label(t("主图"))}
        {variant.image_url ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="thumb" style={{ width: 96, aspectRatio: "1/1", borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
              {isLoadableUrl(variant.image_url) ? (
                <ZoomableImage
                  src={variant.image_url}
                  alt={variant.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : null}
            </div>
            <button className="btn-ghost btn-sm" onClick={() => onPatch({ image_url: null })}>
              {t("移除")}
            </button>
          </div>
        ) : (
          <Upload
            kind="image"
            label={imgBusy ? t("上传中…") : t("上传该变体的主图")}
            onSelect={uploadImage}
          />
        )}
      </div>

      <div>
        {label(t("多角度图"))}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 8 }}>
          {variant.angle_images.map((url, i) => (
            <div
              key={i}
              style={{ position: "relative", aspectRatio: "1/1", borderRadius: 6, overflow: "hidden", background: "var(--surface-3)" }}
            >
              {isLoadableUrl(url) && (
                <ZoomableImage src={url} alt={tf("角度 {n}", { n: i + 1 })} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
              <button
                className="btn-ghost btn-icon"
                onClick={() => removeAngle(i)}
                title={t("移除")}
                style={{ position: "absolute", top: 2, right: 2, padding: 2, background: "rgba(0,0,0,.5)", color: "#fff", borderRadius: 4 }}
              >
                <CloseIcon />
              </button>
            </div>
          ))}
          <label
            className="upload"
            style={{ minHeight: 84, aspectRatio: "1/1", cursor: angleBusy ? "wait" : "pointer", display: "grid", placeItems: "center", padding: 6 }}
          >
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAngle(f);
                e.target.value = "";
              }}
            />
            <span style={{ fontSize: 11, textAlign: "center" }}>
              {angleBusy ? t("上传中…") : <><PlusIcon /> {t("添加角度图")}</>}
            </span>
          </label>
        </div>
      </div>

      <div>
        {label(t("声音参考"))}
        {variant.voice_url ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <audio controls src={variant.voice_url} style={{ flex: 1, height: 36 }} />
            <button className="btn-ghost btn-sm" onClick={() => onPatch({ voice_url: null })}>
              {t("移除")}
            </button>
          </div>
        ) : (
          <Upload
            kind="audio"
            label={voiceBusy ? t("上传中…") : t("上传该变体的声线参考")}
            onSelect={uploadVoice}
          />
        )}
      </div>
    </div>
  );
}
