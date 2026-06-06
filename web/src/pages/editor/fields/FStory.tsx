import { useState } from "react";
import { BookIcon, SparkleIcon } from "@/components/icons";
import { useT, useTf } from "@/lib/i18n";
import type { GlobalLayer } from "@/types";

interface Props {
  value: GlobalLayer;
  set: (g: GlobalLayer) => void;
  onAutoGenShots?: () => void | Promise<void>;
}

export function FStory({ value, set, onAutoGenShots }: Props) {
  const t = useT();
  const tf = useTf();
  const len = (value.story || "").length;
  const [showEx, setShowEx] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const hasStory = !!value.story?.trim();
  const runAutoGen = async () => {
    if (!onAutoGenShots || genLoading) return;
    setGenLoading(true);
    try {
      await onAutoGenShots();
    } finally {
      setGenLoading(false);
    }
  };
  return (
    <div>
      <textarea
        className="textarea textarea-lg"
        placeholder={t("一段连贯的故事，将作为整支视频的叙事骨架……")}
        value={value.story}
        onChange={(e) => set({ ...value, story: e.target.value })}
      />
      {onAutoGenShots && (
        <div style={{ marginTop: 10 }}>
          <button
            className="btn btn-sm"
            disabled={!hasStory || genLoading}
            title={hasStory ? t("调用文字模型，根据故事内容自动拆解并填好多个分镜") : t("请先填写故事内容")}
            onClick={runAutoGen}
          >
            <SparkleIcon /> {genLoading ? t("正在生成分镜…") : t("自动生成分镜头")}
          </button>
        </div>
      )}
      <div
        style={{
          display: "flex", justifyContent: "space-between",
          marginTop: 8, fontSize: 11, color: "var(--text-tertiary)",
        }}
      >
        <button
          className="btn-ghost"
          style={{ padding: "2px 0", fontSize: 12 }}
          onClick={() => setShowEx((s) => !s)}
        >
          <BookIcon /> {t("查看示例")}
        </button>
        <span className="mono">
          {tf("{n} / 50–200 字", { n: len })}
          {len < 50 ? t(" · 偏短") : len > 200 ? t(" · 偏长") : t(" · 合适")}
        </span>
      </div>
      {showEx && (
        <div className="field-example" style={{ marginTop: 10 }}>
          <span className="ex-label">{tf("示例 {n}", { n: 1 })}</span>{t("男主在地铁站偶遇前女友，她身边站着新的男友。三人擦肩而过，他没有回头，但脚步停了一下。")}
          <br /><br />
          <span className="ex-label">{tf("示例 {n}", { n: 2 })}</span>{t("女主第一天到新公司，午休时独自坐在天台。同事递来一杯热咖啡，没有说话便离开。她抬头望向天，第一次笑了。")}
        </div>
      )}
    </div>
  );
}
