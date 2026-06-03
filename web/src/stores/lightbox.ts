import { create } from "zustand";

interface LightboxState {
  src: string | null;
  alt: string;
  open: (src: string, alt?: string) => void;
  close: () => void;
}

// 全局图片放大预览：任意上传图点击后调用 open(url) 即可弹出全屏大图。
export const useLightboxStore = create<LightboxState>((set) => ({
  src: null,
  alt: "",
  open: (src, alt = "") => set({ src, alt }),
  close: () => set({ src: null, alt: "" }),
}));
