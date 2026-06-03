import { createBrowserRouter, Navigate, useLocation } from "react-router-dom";
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

export const router = createBrowserRouter([
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
  { path: "/login",                  element: <LoginPage /> },
  { path: "*",                       element: <Navigate to="/dashboard" replace /> },
]);
