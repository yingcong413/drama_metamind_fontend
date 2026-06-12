import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/primitives/Avatar";
import {
  BellIcon, MoonIcon, SunIcon, GlobeIcon, ChevronIcon, CheckIcon,
  CoinIcon, CrownIcon, GiftIcon, TicketIcon, BillIcon, OrgIcon, WalletIcon,
  OrgPlusIcon, FolderIcon, UsersIcon, ChatIcon, BookIcon, HelpIcon, LockIcon,
  LogoutIcon, ArrowRightIcon,
} from "@/components/icons";
import { useAuthStore, useCanManageOrg, useIsPlatformAdmin } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";
import { useLangStore } from "@/stores/lang";
import { LANGS, useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { getAccount } from "@/api/account";
import { RechargeDialog } from "@/pages/account/RechargeDialog";
import { SubscriptionOverlay } from "@/pages/account/SubscriptionOverlay";
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
  const [showRecharge, setShowRecharge] = useState(false);
  const [showSub, setShowSub] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);

  const { data: account } = useQuery({
    queryKey: ["account"],
    queryFn: getAccount,
    enabled: !!token,
  });
  const credits = account ? Math.round(account.balance_cents / 100) : null;
  const plan = "FREE";

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

  const openRecharge = () => {
    setMenuOpen(false);
    setShowRecharge(true);
  };

  const openSub = () => {
    setMenuOpen(false);
    setShowSub(true);
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

        <div ref={menuWrapRef} className={cn("user-menu", menuOpen && "open")}>
          <div
            className="user-trigger"
            onClick={onAvatarClick}
            title={token ? `${user?.name ?? t("我")}` : t("登录")}
          >
            {token && (
              <span className="credit-pill">
                <span className="cp-coin"><CoinIcon /></span>
                <span className="cp-num">{credits?.toLocaleString() ?? "—"}</span>
                <span className="cp-plan">{plan}</span>
              </span>
            )}
            <Avatar name={user?.name ?? "你"} />
          </div>

          {menuOpen && token && (
            <div className="user-menu-pop" role="menu">
              <div className="um-pad">
                <div className="um-header">
                  <Avatar name={user?.name ?? "你"} size="lg" />
                  <div style={{ minWidth: 0 }}>
                    <div className="um-name">{user?.name ?? t("未命名")}</div>
                    <div className="um-email">{user?.phone ?? t("未绑定手机")}</div>
                  </div>
                  <span className="um-plan">{plan}</span>
                </div>

                <div className="um-actions">
                  <button className="um-btn um-btn-sub" onClick={openSub}>
                    <CrownIcon /> {t("订阅")}
                  </button>
                  <button className="um-btn um-btn-credits" onClick={openRecharge}>
                    <CoinIcon /> {t("购买积分")}
                  </button>
                </div>

                <div className="um-balance">
                  <div className="um-bal-row">
                    <span className="um-bal-coin"><CoinIcon /></span>
                    <span className="um-bal-num">{credits?.toLocaleString() ?? "—"}</span>
                    <button className="um-bal-link" onClick={() => go("/account")}>
                      <span className="dot" />{t("余额明细")} <ArrowRightIcon />
                    </button>
                  </div>
                  <div className="um-bonus">
                    <span className="lbl">{t("每日免费奖励")}</span>
                    <button
                      className="um-claim"
                      disabled={claimed}
                      onClick={() => setClaimed(true)}
                    >
                      <GiftIcon /> {claimed ? t("已领取") : t("领取 +60")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="um-sep" />
              <div className="um-list">
                <button className="um-item" onClick={() => go("/account")}>
                  <TicketIcon />{t("兑换邀请码")}
                  <span className="um-right"><span className="um-rewards"><GiftIcon />{t("奖励")}</span></span>
                </button>
                <button className="um-item" onClick={() => go("/account")}>
                  <BillIcon />{t("账户与计费")}
                </button>
                {canManageOrg && (
                  <button className="um-item" onClick={() => go("/org")}>
                    <OrgIcon />{t("组织管理")}
                  </button>
                )}
              </div>

              {isPlatformAdmin && (
                <>
                  <div className="um-sep" />
                  <div className="um-label">Admin</div>
                  <div className="um-list">
                    <button className="um-item" onClick={() => go("/admin/recharge")}>
                      <WalletIcon />{t("手动充值")}
                    </button>
                    <button className="um-item" onClick={() => go("/admin/create-org")}>
                      <OrgPlusIcon />{t("替人开企业")}
                    </button>
                    <button className="um-item" onClick={() => go("/admin/projects")}>
                      <FolderIcon />{t("所有项目")}
                    </button>
                    <button className="um-item" onClick={() => go("/admin/users")}>
                      <UsersIcon />{t("账号管理")}
                    </button>
                    <button className="um-item" onClick={() => go("/admin/usage")}>
                      <CoinIcon />{t("所有消耗")}
                    </button>
                    <button className="um-item" onClick={() => go("/admin/pricing")}>
                      <WalletIcon />{t("Credit 定价")}
                    </button>
                  </div>
                </>
              )}

              <div className="um-sep" />
              <div className="um-list">
                <button className="um-item"><ChatIcon />{t("用户反馈")}</button>
                <button className="um-item"><BookIcon />{t("使用手册")}</button>
                <button className="um-item"><HelpIcon />{t("常见问题")}</button>
              </div>

              <div className="um-sep" />
              <div className="um-list">
                <button
                  className="um-item"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowPwd(true);
                  }}
                >
                  <LockIcon />{t("修改密码")}
                </button>
                <button className="um-item danger" onClick={onLogout}>
                  <LogoutIcon />{t("退出登录")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPwd && <ChangePasswordDialog onClose={() => setShowPwd(false)} />}
      {showRecharge && account && (
        <RechargeDialog account={account} onClose={() => setShowRecharge(false)} />
      )}
      {showSub && (
        <SubscriptionOverlay
          credits={credits}
          onClose={() => setShowSub(false)}
          onBuyCredits={() => {
            setShowSub(false);
            setShowRecharge(true);
          }}
        />
      )}
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

