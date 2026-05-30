import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AccountType, MemberRole, User } from "@/types";

interface AuthState {
  token: string | null;
  user: User | null;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: "metamind-auth" },
  ),
);

// ─────────────────────────────────────────────────────────────
// 多账户策略(PRD v0.9 §1.5)便捷 selector
// 组件内使用:
//   const isOwner = useIsOwner();          // 是 Owner?
//   const role = useRole();                // "owner" | "member" | null(未登录)
//   const type = useAccountType();         // "personal" | "enterprise" | null
//   const canManageOrg = useCanManageOrg();// Owner && enterprise
// ─────────────────────────────────────────────────────────────

export function useRole(): MemberRole | null {
  return useAuthStore((s) => s.user?.role ?? null);
}

export function useIsOwner(): boolean {
  return useAuthStore((s) => s.user?.role === "owner");
}

export function useAccountType(): AccountType | null {
  return useAuthStore((s) => s.user?.org?.account_type ?? null);
}

/** 是否能看到/进入「组织管理」页:必须是企业账户且本人是 Owner */
export function useCanManageOrg(): boolean {
  return useAuthStore(
    (s) =>
      s.user?.role === "owner" && s.user?.org?.account_type === "enterprise",
  );
}

/** v0.9.1 §1.5.6 — 是否平台管理员;能看「平台管理」入口 + 充值面板 */
export function useIsPlatformAdmin(): boolean {
  return useAuthStore((s) => s.user?.is_platform_admin === true);
}
