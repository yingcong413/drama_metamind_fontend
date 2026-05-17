import { Fragment, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Avatar } from "@/components/primitives/Avatar";
import { BellIcon, MoonIcon, SunIcon } from "@/components/icons";
import { useAuthStore } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";
import { cn } from "@/lib/cn";

export interface Crumb {
  label: string;
  to?: string;
}

interface AppTopBarProps {
  crumbs?: Crumb[];
  actions?: ReactNode;
}

const NAV: Array<{ to: string; label: string; match: (p: string) => boolean }> = [
  { to: "/dashboard",  label: "项目",     match: (p) => p === "/" || p.startsWith("/dashboard") },
  { to: "/editor",     label: "工作台",   match: (p) => p.startsWith("/editor") || /\/projects\/[^/]+\/edit/.test(p) },
  { to: "/characters", label: "角色库",   match: (p) => p.startsWith("/characters") },
  { to: "/result",     label: "生成结果", match: (p) => p.startsWith("/result") || /\/projects\/[^/]+\/result/.test(p) },
  { to: "/account",    label: "使用记录", match: (p) => p.startsWith("/account") },
];

export function AppTopBar({ crumbs = [], actions }: AppTopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  const onAvatarClick = () => {
    navigate(token ? "/account" : "/login");
  };

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="brand">
          <div className="brand-mark">制</div>
          <span>制影 AI</span>
        </div>
        {crumbs.length > 0 && (
          <div className="crumb">
            {crumbs.map((c, i) => (
              <Fragment key={i}>
                <span className="sep">/</span>
                {c.to ? (
                  <button className="btn-ghost btn-sm" onClick={() => navigate(c.to!)}>
                    {c.label}
                  </button>
                ) : (
                  <span className={i === crumbs.length - 1 ? "here" : ""}>{c.label}</span>
                )}
              </Fragment>
            ))}
          </div>
        )}
      </div>

      <div className="topnav">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={() => cn(n.match(location.pathname) && "active")}
          >
            {n.label}
          </NavLink>
        ))}
      </div>

      <div className="topbar-right">
        <button className="btn-ghost btn-icon" title="主题" onClick={toggle}>
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
        <button className="btn-ghost btn-icon" title="通知">
          <BellIcon />
        </button>
        {actions}
        <button
          onClick={onAvatarClick}
          title={token ? `${user?.name ?? "我"} · 查看账户` : "登录"}
          style={{
            padding: 0,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            display: "inline-flex",
            borderRadius: "50%",
          }}
        >
          <Avatar name={user?.name ?? "你"} />
        </button>
      </div>
    </div>
  );
}
