import { createScene, deleteScene, listScenes, updateScene } from "@/api/scenes";
import { MediaLibrary, type MediaLibraryConfig } from "@/pages/library/MediaLibrary";

const config: MediaLibraryConfig = {
  kind: "scene",
  queryKey: "scenes",
  list: listScenes,
  create: createScene,
  update: updateScene,
  remove: deleteScene,
  pageTitle: "场景库",
  enLabel: "Scene Library",
  subtitle:
    "全局资源，跨项目复用。每个场景由「名字 / 参考图」两部分组成 —— 你在「字段 04 · 场景」中通过此处建立的场景进行调用。",
  createLabel: "新建场景",
  searchPlaceholder: "搜索场景名…",
  uploadPrefix: "global_scenes",
  nameLabel: "场景名",
  namePlaceholder: "如：城市街道夜景",
  confirmDelete: "确认删除场景「{name}」？此操作不可撤销。",
};

export function ScenesPage() {
  return <MediaLibrary config={config} />;
}
