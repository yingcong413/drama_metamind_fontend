import { createBrowserRouter, createHashRouter, Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { EditorPage } from "@/pages/editor/EditorPage";
import { CharactersPage } from "@/pages/characters/CharactersPage";
import { ScenesPage } from "@/pages/scenes/ScenesPage";
import { PropsPage } from "@/pages/props/PropsPage";
import { ResultPage } from "@/pages/result/ResultPage";
import { AccountPage } from "@/pages/account/AccountPage";
import { OrgPage } from "@/pages/org/OrgPage";
import { AdminRechargePage } from "@/pages/admin/AdminRechargePage";
import { AdminCreateOrgPage } from "@/pages/admin/AdminCreateOrgPage";
import { AdminProjectsPage } from "@/pages/admin/AdminProjectsPage";
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage";
import { AdminUsagePage } from "@/pages/admin/AdminUsagePage";
import { AdminPricingPage } from "@/pages/admin/AdminPricingPage";
import { LoginPage } from "@/pages/login/LoginPage";
import { useAuthStore } from "@/stores/auth";

/** 包一层鉴权:无 token 直接跳 /login,并把当前路径放 state.from,登录后可返回 */
function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }
  return <>{children}</>;
}

// 单文件 demo(file:// 双击)用 hash 路由,常规部署仍用 history 路由
const makeRouter = import.meta.env.VITE_HASH_ROUTER === "true" ? createHashRouter : createBrowserRouter;

export const router = makeRouter([
  { path: "/",                       element: <Navigate to="/dashboard" replace /> },
  { path: "/dashboard",              element: <RequireAuth><DashboardPage /></RequireAuth> },
  { path: "/editor",                 element: <RequireAuth><EditorPage /></RequireAuth> },
  { path: "/projects/:id/edit",      element: <RequireAuth><EditorPage /></RequireAuth> },
  { path: "/characters",             element: <RequireAuth><CharactersPage /></RequireAuth> },
  { path: "/scenes",                 element: <RequireAuth><ScenesPage /></RequireAuth> },
  { path: "/props",                  element: <RequireAuth><PropsPage /></RequireAuth> },
  { path: "/result",                 element: <RequireAuth><ResultPage /></RequireAuth> },
  { path: "/projects/:id/result",    element: <RequireAuth><ResultPage /></RequireAuth> },
  { path: "/account",                element: <RequireAuth><AccountPage /></RequireAuth> },
  // 组织管理 —— 任何登录用户都能进:个人 Owner 看升级 CTA,企业 Owner 看完整管理面板,Member 看「离开组织」
  { path: "/org",                    element: <RequireAuth><OrgPage /></RequireAuth> },
  // 平台管理(PRD §1.5.6 + §10.8.5);页面内部会用 useIsPlatformAdmin 二次校验,非 admin 跳走
  { path: "/admin/recharge",         element: <RequireAuth><AdminRechargePage /></RequireAuth> },
  // v0.9.5: 平台管理员替客户开企业账户
  { path: "/admin/create-org",       element: <RequireAuth><AdminCreateOrgPage /></RequireAuth> },
  // v0.9.23: 平台管理员查看全平台项目并导入复现
  { path: "/admin/projects",         element: <RequireAuth><AdminProjectsPage /></RequireAuth> },
  // v0.9.27: 平台管理员管理所有账号(验证账号 / 额度)
  { path: "/admin/users",            element: <RequireAuth><AdminUsersPage /></RequireAuth> },
  // v3: 平台管理员查看全平台积分消耗(主/子账号 · token · 快币)
  { path: "/admin/usage",            element: <RequireAuth><AdminUsagePage /></RequireAuth> },
  // v3: 平台管理员调 Credit 定价(充值档基准 + 四套订阅倍率/折扣核算)
  { path: "/admin/pricing",          element: <RequireAuth><AdminPricingPage /></RequireAuth> },
  { path: "/login",                  element: <LoginPage /> },
  { path: "*",                       element: <Navigate to="/dashboard" replace /> },
]);
