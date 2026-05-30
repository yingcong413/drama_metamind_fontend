/**
 * 记录用户最近打开过的项目 id,/editor 路径无参数时用它跳回正确的项目。
 *
 * 存在 localStorage 而不是 zustand store —— 跨会话也要保留,且没有别的地方
 * 需要订阅这个值的变化(只在 EditorPage 进出 + 删除项目时读写)。
 */

const KEY = "metamind-last-project-v1";

export function getLastProjectId(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

export function setLastProjectId(id: string | null | undefined): void {
  try {
    if (!id) {
      localStorage.removeItem(KEY);
      return;
    }
    // 不接受 "new" / 占位 id —— 那不是真实项目,跳回去会一直白屏
    if (id === "new") return;
    localStorage.setItem(KEY, id);
  } catch {
    /* localStorage 写失败(隐私模式 / 配额满)时静默忽略 —— 失去记忆 ≠ 致命 */
  }
}

export function clearLastProjectId(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 同上 */
  }
}

/** 删除项目时如果该 id 正是 lastProject,顺手清掉避免下次访问 /editor 走到死项目 */
export function clearLastProjectIfMatch(id: string): void {
  if (getLastProjectId() === id) clearLastProjectId();
}
