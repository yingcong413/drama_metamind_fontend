// _mockStorage.ts —— mock 模式下用 localStorage 模拟「数据库」
// 后端就绪切到真接口后，整段 mock 路径都不会跑，此文件不需要
//
// 设计：
//   - 按表（characters / assets）分别 key
//   - 版本号后缀 v1，schema 改动时升 v2 自动失效旧数据
//   - SSR / 非浏览器环境（Node 测试等）自动降级到内存

// v0.9.5 教训:**不要随便升 VERSION** —— 升 v2 会把所有老用户已经建的真实项目
// 一起当成"过期数据"丢弃,体验上等同删号。
// 正确做法是只清空 DEFAULT_*(只影响没有 localStorage 记录的新浏览器),
// VERSION 保持 v1,老用户的真实数据继续生效。
const VERSION = "v1";
const NS = `metamind-mock-${VERSION}`;

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    if (!("localStorage" in window)) return null;
    // 触一下检测 quota / 隐私模式
    const k = `${NS}-probe`;
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return null;
  }
}

const storage = safeStorage();

export function loadJSON<T>(table: string, fallback: T): T {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(`${NS}-${table}`);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON(table: string, value: unknown): void {
  if (!storage) return;
  try {
    storage.setItem(`${NS}-${table}`, JSON.stringify(value));
  } catch {
    // 配额满 / 隐私模式 → 静默忽略，下次刷新会丢，但不影响当前会话
  }
}

/** 调试用：清空 mock 库。在浏览器 console 跑 window._resetMockDB() 也可触发 */
export function clearMockStorage(): void {
  if (!storage) return;
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(NS)) keys.push(k);
  }
  keys.forEach((k) => storage.removeItem(k));
}

if (typeof window !== "undefined") {
  // 让用户在浏览器 console 里 `_resetMockDB()` 一键清空
  (window as unknown as { _resetMockDB?: () => void })._resetMockDB = clearMockStorage;
}
