import type { Shot } from "@/types";

interface Props {
  shotIndex: number;
  prev: Shot;
}

export function PrevContext({ shotIndex, prev }: Props) {
  return (
    <div className="prev-context">
      <div className="icon-circ">{String(shotIndex).padStart(2, "0")}</div>
      <div>
        <strong>上一个分镜以「{prev.action?.end || "—"}」结束</strong>
        <div className="dim" style={{ marginTop: 2 }}>
          建议本分镜的起点动作与上一镜结束状态自然衔接，避免画面跳跃。
        </div>
      </div>
    </div>
  );
}
