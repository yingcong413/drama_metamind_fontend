import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Lang = "zh-CN" | "zh-TW" | "en" | "fr" | "es" | "ar";

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      lang: "zh-CN",
      setLang: (lang) => set({ lang }),
    }),
    { name: "metamind-lang" },
  ),
);
