import { useLangStore, type Lang } from "@/stores/lang";
import { DICT } from "./i18nDict";

export type { Lang };

export const LANGS: Array<{ code: Lang; name: string; short: string }> = [
  { code: "en", name: "English", short: "EN" },
  { code: "fr", name: "Français", short: "FR" },
  { code: "zh-CN", name: "简体中文", short: "简体" },
  { code: "zh-TW", name: "繁體中文", short: "繁體" },
  { code: "es", name: "Español", short: "ES" },
  { code: "ar", name: "العربية", short: "العربية" },
];

const RTL_LANGS: Lang[] = ["ar"];
export const isRTL = (l: Lang) => RTL_LANGS.includes(l);

/**
 * 以「中文原文」为 key 的轻量翻译：源码里现有中文保持不变即是查表 key。
 * 命中翻译表返回译文，未命中（含 zh-CN）回退原中文 —— 未翻译的字符串仍正常显示中文。
 */
export function translate(zh: string, lang: Lang): string {
  if (lang === "zh-CN") return zh;
  return DICT[lang]?.[zh] ?? zh;
}

/** React 组件内用：语言变化会触发重渲染 */
export function useT() {
  const lang = useLangStore((s) => s.lang);
  return (zh: string) => translate(zh, lang);
}

export function useLang() {
  return useLangStore((s) => s.lang);
}

/** 带占位符插值的翻译：t 后把 {key} 替换成实参，兼顾各语言词序。 */
export function useTf() {
  const lang = useLangStore((s) => s.lang);
  return (zh: string, vars: Record<string, string | number>) => {
    let s = translate(zh, lang);
    for (const k in vars) s = s.split(`{${k}}`).join(String(vars[k]));
    return s;
  };
}

/** 非组件（工具函数 / 事件回调）里取译文；不具响应性，仅用于一次性读取 */
export function t(zh: string): string {
  return translate(zh, useLangStore.getState().lang);
}
