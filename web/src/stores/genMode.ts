import { create } from "zustand";
import { persist } from "zustand/middleware";

// 工作台左上角的生成模式:工作流(无限画布) / 精细控制(整套编辑器) / 首尾帧 / 智能多帧。
export type GenMode = "workflow" | "regular" | "first_last" | "smart_multi";

interface GenModeState {
  mode: GenMode;
  setMode: (m: GenMode) => void;
}

export const useGenModeStore = create<GenModeState>()(
  persist(
    (set) => ({
      mode: "workflow",
      setMode: (mode) => set({ mode }),
    }),
    { name: "metamind-genmode" },
  ),
);
