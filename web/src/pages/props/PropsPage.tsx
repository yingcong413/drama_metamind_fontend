import { createProp, deleteProp, listProps, updateProp } from "@/api/props";
import { MediaLibrary, type MediaLibraryConfig } from "@/pages/library/MediaLibrary";

const config: MediaLibraryConfig = {
  kind: "prop",
  queryKey: "props",
  list: listProps,
  create: createProp,
  update: updateProp,
  remove: deleteProp,
  pageTitle: "道具库",
  enLabel: "Prop Library",
  subtitle:
    "全局资源，跨项目复用。每个道具由「名字 / 参考图」两部分组成 —— 你在「字段 06 · 道具」中通过此处建立的道具进行调用。",
  createLabel: "新建道具",
  searchPlaceholder: "搜索道具名…",
  uploadPrefix: "global_props",
  nameLabel: "道具名",
  namePlaceholder: "如：复古机械手表",
  confirmDelete: "确认删除道具「{name}」？此操作不可撤销。",
};

export function PropsPage() {
  return <MediaLibrary config={config} />;
}
