import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Avatar } from "@/components/primitives/Avatar";
import { BellIcon, MoonIcon, SunIcon, GlobeIcon, ChevronIcon, CheckIcon } from "@/components/icons";
import { useAuthStore, useCanManageOrg, useIsPlatformAdmin } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";
import { useLangStore } from "@/stores/lang";
import { LANGS, useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { ChangePasswordDialog } from "@/pages/account/ChangePasswordDialog";

export interface Crumb {
  label: string;
  to?: string;
}

interface AppTopBarProps {
  crumbs?: Crumb[];
  actions?: ReactNode;
  /** 固定渲染在顶栏左侧(面包屑之后)的额外内容,如工作台的模式切换条 */
  leftExtra?: ReactNode;
  /** 隐藏中间的全站导航(项目/工作台/…),用于首尾帧 / 智能多帧独立画面 */
  hideNav?: boolean;
}

const NAV: Array<{ to: string; label: string; match: (p: string) => boolean }> = [
  { to: "/dashboard",  label: "项目",     match: (p) => p === "/" || p.startsWith("/dashboard") },
  { to: "/editor",     label: "工作台",   match: (p) => p.startsWith("/editor") || /\/projects\/[^/]+\/edit/.test(p) },
  { to: "/characters", label: "角色库",   match: (p) => p.startsWith("/characters") },
  { to: "/scenes",     label: "场景库",   match: (p) => p.startsWith("/scenes") },
  { to: "/props",      label: "道具库",   match: (p) => p.startsWith("/props") },
  { to: "/result",     label: "生成结果", match: (p) => p.startsWith("/result") || /\/projects\/[^/]+\/result/.test(p) },
  { to: "/account",    label: "使用记录", match: (p) => p.startsWith("/account") },
];

export function AppTopBar({ crumbs = [], actions, leftExtra, hideNav = false }: AppTopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const canManageOrg = useCanManageOrg();
  const isPlatformAdmin = useIsPlatformAdmin();

  const [menuOpen, setMenuOpen] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);

  // 点外面关菜单
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuWrapRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const onAvatarClick = () => {
    if (!token) {
      navigate("/login");
      return;
    }
    setMenuOpen((v) => !v);
  };

  const go = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  const onLogout = () => {
    setMenuOpen(false);
    logout();
    navigate("/login");
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
        {leftExtra}
      </div>

      {!hideNav && (
        <div className="topnav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={() => cn(n.match(location.pathname) && "active")}
            >
              {t(n.label)}
            </NavLink>
          ))}
        </div>
      )}

      <div className="topbar-right">
        <button className="btn-ghost btn-icon" title={t("主题")} onClick={toggle}>
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
        <LangSwitch />
        <button className="btn-ghost btn-icon" title={t("通知")}>
          <BellIcon />
        </button>
        {actions}

        <div ref={menuWrapRef} style={{ position: "relative" }}>
          <button
            onClick={onAvatarClick}
            title={token ? `${user?.name ?? t("我")}` : t("登录")}
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

          {menuOpen && token && (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                minWidth: 220,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                boxShadow: "0 12px 36px rgba(0,0,0,.35)",
                padding: 6,
                zIndex: 100,
              }}
            >
              {/* 用户信息预览 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--border)",
                  marginBottom: 4,
                }}
              >
                <Avatar name={user?.name ?? "你"} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {user?.name ?? t("未命名")}
                  </div>
                  <div
                    className="dim-2 mono"
                    style={{ fontSize: 11, marginTop: 2 }}
                  >
                    {user?.phone ?? t("未绑定手机")}
                  </div>
                </div>
              </div>

              <MenuItem onClick={() => go("/account")}>{t("账户与计费")}</MenuItem>
              {canManageOrg && (
                <MenuItem onClick={() => go("/org")}>
                  {t("组织管理")}
                  <span
                    className="dim-2 mono"
                    style={{ fontSize: 10, marginLeft: 6 }}
                  >
                    Owner
                  </span>
                </MenuItem>
              )}
              {isPlatformAdmin && (
                <MenuItem onClick={() => go("/admin/recharge")}>
                  {t("平台管理 · 手动充值")}
                  <span
                    className="dim-2 mono"
                    style={{ fontSize: 10, marginLeft: 6, color: "oklch(72% .14 70)" }}
                  >
                    ADMIN
                  </span>
                </MenuItem>
              )}
              {isPlatformAdmin && (
                <MenuItem onClick={() => go("/admin/create-org")}>
                  {t("平台管理 · 替人开企业")}
                  <span
                    className="dim-2 mono"
                    style={{ fontSize: 10, marginLeft: 6, color: "oklch(72% .14 70)" }}
                  >
                    ADMIN
                  </span>
                </MenuItem>
              )}
              {isPlatformAdmin && (
                <MenuItem onClick={() => go("/admin/projects")}>
                  {t("平台管理 · 所有项目")}
                  <span
                    className="dim-2 mono"
                    style={{ fontSize: 10, marginLeft: 6, color: "oklch(72% .14 70)" }}
                  >
                    ADMIN
                  </span>
                </MenuItem>
              )}
              {isPlatformAdmin && (
                <MenuItem onClick={() => go("/admin/users")}>
                  {t("平台管理 · 账号管理")}
                  <span
                    className="dim-2 mono"
                    style={{ fontSize: 10, marginLeft: 6, color: "oklch(72% .14 70)" }}
                  >
                    ADMIN
                  </span>
                </MenuItem>
              )}
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  setShowPwd(true);
                }}
              >
                {t("修改密码")}
              </MenuItem>
              <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
              <MenuItem onClick={onLogout} danger>
                {t("退出登录")}
              </MenuItem>
            </div>
          )}
        </div>
      </div>

      {showPwd && <ChangePasswordDialog onClose={() => setShowPwd(false)} />}
    </div>
  );
}

function LangSwitch() {
  const [open, setOpen] = useState(false);
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const cur = LANGS.find((l) => l.code === lang) ?? LANGS[2];

  return (
    <div className="lang-switch" ref={wrapRef}>
      <button
        className="btn-ghost btn-sm lang-btn"
        title="语言 / Language"
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        <GlobeIcon />
        <span className="lang-cur mono">{cur.short}</span>
        <ChevronIcon className="icon chev" />
      </button>
      {open && (
        <div className="lang-menu">
          {LANGS.map((l) => (
            <button
              key={l.code}
              className={cn("lang-opt", l.code === lang && "active")}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
            >
              <span className="lang-name">{l.name}</span>
              {l.code === lang && <CheckIcon className="icon ck" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger = false,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        padding: "9px 12px",
        textAlign: "left",
        background: "transparent",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 13,
        color: danger ? "oklch(72% .15 25)" : "var(--text)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}
