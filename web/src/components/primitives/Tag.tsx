import type { ReactNode } from "react";

export type TagKind = "req" | "opt" | "upload" | "audio";

interface Props {
  kind: TagKind;
  children?: ReactNode;
}

const CLASS: Record<TagKind, string> = {
  req: "tag-req",
  opt: "tag-opt",
  upload: "tag-upload",
  audio: "tag-audio",
};
const LABEL: Record<TagKind, string> = {
  req: "必填",
  opt: "可选",
  upload: "上传",
  audio: "需音频",
};

export function Tag({ kind, children }: Props) {
  return <span className={`tag ${CLASS[kind]}`}>{children ?? LABEL[kind]}</span>;
}
