import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronIcon, CloseIcon, PlusIcon, SparkleIcon } from "@/components/icons";
import { ZoomableImage } from "@/components/primitives/ZoomableImage";
import { isLoadableUrl } from "@/lib/format";
import { useT, useTf } from "@/lib/i18n";
import { uploadLibraryImage } from "@/lib/uploadLibraryImage";
import type { FrameSegment, GlobalLayer } from "@/types";
import { FrameRecords } from "./FrameRecords";

const EMPTY_SEG: FrameSegment = { seconds: 0, desc: "" };
// 画面描述图标(运镜段)
const CaptionIcon = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
    <rect x="3" y="4.5" width="14" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M7 9h6M7 12h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

type FrameMode = "first_last" | "smart_multi";

interface Props {
  mode: FrameMode;
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
  onGenerate: () => void;
}

const FRAME_RATIOS = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
const RATIO_SHAPE: Record<string, { w: number; h: number }> = {
  "21:9": { w: 26, h: 11 },
  "16:9": { w: 24, h: 13.5 },
  "4:3": { w: 20, h: 15 },
  "1:1": { w: 17, h: 17 },
  "3:4": { w: 15, h: 20 },
  "9:16": { w: 12, h: 21 },
};
const FRAME_RES = ["720P", "1080P"];
const DURATIONS = Array.from({ length: 12 }, (_, i) => i + 4); // 4s..15s

export function FrameComposer({ mode, value, set, onGenerate }: Props) {
  const t = useT();
  const tf = useTf();
  const ratio = value.frame_ratio ?? "16:9";
  const resolution = value.frame_resolution ?? "720P";
  const duration = value.total_duration_seconds ?? 5;
  const prompt = value.frame_prompt ?? "";

  const placeholder =
    mode === "first_last"
      ? t("结合图片，描述你想生成的画面和动作。例如：海浪拍打着沙滩，粉色的月亮在天空缓缓升起。")
      : t("结合图片，描述这组智能多帧镜头的画面与衔接方式。");

  const multiFrames = value.multi_frame_urls ?? [];
  const segments = value.multi_frame_segments ?? [];
  const getSeg = (i: number): FrameSegment => segments[i] ?? EMPTY_SEG;
  // 段数 = 帧数 + 1(每帧前后各一个),保证长度足够
  const ensureSegs = (n: number) => {
    const next = segments.slice(0, n);
    while (next.length < n) next.push({ ...EMPTY_SEG });
    return next;
  };
  const patchSeg = (i: number, p: Partial<FrameSegment>) => {
    const next = ensureSegs(Math.max(segments.length, i + 1));
    next[i] = { ...next[i], ...p };
    set({ ...value, multi_frame_segments: next });
  };
  const applyAllSeconds = (sec: number) => {
    const n = Math.max(segments.length, multiFrames.length + 1);
    const next = ensureSegs(n).map((s) => ({ ...s, seconds: sec }));
    set({ ...value, multi_frame_segments: next });
  };

  const hasFrames =
    mode === "first_last"
      ? !!(value.first_frame_url || value.last_frame_url)
      : multiFrames.length > 0;

  const clearAll = () =>
    set({
      ...value,
      frame_prompt: "",
      first_frame_url: null,
      last_frame_url: null,
      multi_frame_urls: [],
      multi_frame_segments: [],
    });

  return (
    <div className="fc-page">
      <div className="fc-col">
        <div className="fc-card">
          <div className="fc-top">
            {mode === "first_last" ? (
              <div className="fc-frames">
                <FrameSlot
                  label={t("首帧")}
                  url={value.first_frame_url ?? null}
                  onUpload={(url) => set({ ...value, first_frame_url: url })}
                  onClear={() => set({ ...value, first_frame_url: null })}
                />
                <span className="fc-swap" aria-hidden>⇄</span>
                <FrameSlot
                  label={t("尾帧")}
                  url={value.last_frame_url ?? null}
                  onUpload={(url) => set({ ...value, last_frame_url: url })}
                  onClear={() => set({ ...value, last_frame_url: null })}
                />
              </div>
            ) : (
              <div className="fc-frames fc-frames-multi">
                {/* 有图后才在最前面出现「段」框;空状态只显示一个上传框 */}
                {multiFrames.length > 0 && (
                  <SegBox seg={getSeg(0)} onChange={(p) => patchSeg(0, p)} onApplyAll={applyAllSeconds} />
                )}
                {multiFrames.map((url, i) => (
                  <Fragment key={i}>
                    <FrameSlot
                      label={tf("第 {n} 帧", { n: i + 1 })}
                      url={url}
                      onUpload={(u) => {
                        const next = [...multiFrames];
                        next[i] = u;
                        set({ ...value, multi_frame_urls: next });
                      }}
                      onClear={() =>
                        set({
                          ...value,
                          multi_frame_urls: multiFrames.filter((_, j) => j !== i),
                          multi_frame_segments: segments.filter((_, j) => j !== i + 1),
                        })
                      }
                    />
                    <SegBox seg={getSeg(i + 1)} onChange={(p) => patchSeg(i + 1, p)} onApplyAll={applyAllSeconds} />
                  </Fragment>
                ))}
                <FrameSlot
                  label={tf("第 {n} 帧", { n: multiFrames.length + 1 })}
                  url={null}
                  onUpload={(u) => set({ ...value, multi_frame_urls: [...multiFrames, u] })}
                  onClear={() => {}}
                />
              </div>
            )}

            <textarea
              className="fc-prompt"
              placeholder={mode === "smart_multi" && !hasFrames ? t("请添加智能多帧的镜头") : placeholder}
              value={prompt}
              onChange={(e) => set({ ...value, frame_prompt: e.target.value })}
            />
          </div>

          <div className="fc-bar">
            <div className="fc-controls">
              <RatioResPopover
                ratio={ratio}
                resolution={resolution}
                onRatio={(v) => set({ ...value, frame_ratio: v })}
                onRes={(v) => set({ ...value, frame_resolution: v })}
              />
              <DurationPopover value={duration} onChange={(d) => set({ ...value, total_duration_seconds: d })} />
            </div>
            <button className="btn-ghost btn-sm fc-clear" onClick={clearAll} title={t("清空当前画面")}>
              {t("全部清空")}
            </button>
            <button
              className="btn btn-primary fc-gen"
              disabled={!hasFrames}
              title={hasFrames ? t("生成视频") : t("请先上传参考帧")}
              onClick={onGenerate}
            >
              <SparkleIcon /> {t("生成视频")}
            </button>
          </div>
        </div>

        <FrameRecords />
      </div>
    </div>
  );
}

function FrameSlot({
  label,
  url,
  onUpload,
  onClear,
}: {
  label: string;
  url: string | null;
  onUpload: (url: string) => void;
  onClear: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  const pick = async (file: File) => {
    setBusy(true);
    try {
      const u = await uploadLibraryImage(file, "frame_images");
      onUpload(u);
    } catch (e) {
      alert(t("上传图片失败:") + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  if (url) {
    return (
      <div className="fc-slot fc-slot-filled">
        {isLoadableUrl(url) && (
          <ZoomableImage src={url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        <span className="fc-slot-tag">{label}</span>
        <button className="fc-slot-x" onClick={onClear} title={t("移除")}>
          <CloseIcon />
        </button>
      </div>
    );
  }

  return (
    <label className="fc-slot fc-slot-empty">
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />
      <span className="fc-slot-plus">{busy ? "…" : <PlusIcon />}</span>
      <span className="fc-slot-label">{busy ? t("上传中…") : label}</span>
    </label>
  );
}

// 智能多帧:关键帧前后的「段」——显示秒数,点开可填运镜/画面描述并改秒数
function SegBox({
  seg,
  onChange,
  onApplyAll,
}: {
  seg: FrameSegment;
  onChange: (p: Partial<FrameSegment>) => void;
  onApplyAll: (sec: number) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const clamp = (n: number) => Math.min(15, Math.max(0, n));

  return (
    <div className="fc-seg-wrap" ref={ref}>
      <button
        type="button"
        className={"fc-seg" + (seg.desc ? " has-desc" : "")}
        data-tip={t("添加画面描述")}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="fc-seg-ico"><CaptionIcon /></span>
        <span className="fc-seg-val">{seg.seconds}s</span>
      </button>
      {open && (
        <div className="fc-pop fc-seg-pop">
          <div className="fc-seg-pop-title">{t("运镜描述")}</div>
          <textarea
            className="fc-seg-desc"
            placeholder={t("请描述镜头之间的转换画面或运动方式")}
            value={seg.desc}
            onChange={(e) => onChange({ desc: e.target.value })}
            autoFocus
          />
          <div className="fc-seg-pop-bar">
            <label className="fc-pill">
              <input
                type="number"
                min={0}
                max={15}
                step={0.5}
                className="fc-seg-num"
                value={seg.seconds}
                onChange={(e) => onChange({ seconds: clamp(Number(e.target.value) || 0) })}
              />
              <span className="fc-pill-label">s</span>
            </label>
            <button className="btn btn-sm" onClick={() => onApplyAll(seg.seconds)}>
              {t("应用至全部")}
            </button>
            <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => setOpen(false)}>
              {t("确认")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 比例 + 分辨率:一个「自动匹配」气泡,内含 6 种比例(可视形状)+ 720P/1080P
function RatioResPopover({
  ratio,
  resolution,
  onRatio,
  onRes,
}: {
  ratio: string;
  resolution: string;
  onRatio: (v: string) => void;
  onRes: (v: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div className="fc-pop-wrap" ref={ref}>
      <button type="button" className="fc-pill fc-pill-btn" onClick={() => setOpen((v) => !v)}>
        <span className="fc-pill-label">{t("自动匹配")}</span>
        <span style={{ color: "var(--text)" }}>{ratio}</span>
        <span style={{ color: "var(--text-secondary)" }}>· {resolution}</span>
        <ChevronIcon className="icon chev" />
      </button>
      {open && (
        <div className="fc-pop">
          <div className="fc-pop-title">{t("选择比例")}</div>
          <div className="fc-ratio-grid">
            {FRAME_RATIOS.map((r) => {
              const s = RATIO_SHAPE[r];
              return (
                <button
                  key={r}
                  type="button"
                  className={"fc-ratio-opt col" + (ratio === r ? " active" : "")}
                  onClick={() => onRatio(r)}
                >
                  <span className="fc-ratio-box" style={{ width: s.w, height: s.h }} />
                  <span>{r}</span>
                </button>
              );
            })}
          </div>
          <div className="fc-pop-title">{t("选择分辨率")}</div>
          <div className="fc-res-row">
            {FRAME_RES.map((r) => (
              <button
                key={r}
                type="button"
                className={"fc-res-opt" + (resolution === r ? " active" : "")}
                onClick={() => onRes(r)}
              >
                {r}
                {r === "1080P" && <SparkleIcon />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 时长:4s–15s 列表气泡
function DurationPopover({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div className="fc-pop-wrap" ref={ref}>
      <button type="button" className="fc-pill fc-pill-btn" onClick={() => setOpen((v) => !v)}>
        <span style={{ color: "var(--text)" }}>{value}s</span>
        <ChevronIcon className="icon chev" />
      </button>
      {open && (
        <div className="fc-pop fc-pop-dur">
          <div className="fc-pop-title">{t("选择视频生成时长")}</div>
          <div className="fc-dur-list">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                className={"fc-dur-opt" + (value === d ? " active" : "")}
                onClick={() => {
                  onChange(d);
                  setOpen(false);
                }}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
