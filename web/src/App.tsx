import { useEffect, useState } from "react";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "@/router";
import { useThemeStore } from "@/stores/theme";
import { useLangStore } from "@/stores/lang";
import { isRTL, t } from "@/lib/i18n";
import { useAuthStore } from "@/stores/auth";
import { USE_MOCK, USE_REAL_AUTH } from "@/api/client";
import { loginPhone } from "@/api/auth";
import { Lightbox } from "@/components/primitives/Lightbox";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

/** mock 模式下,没 token 就自动登录成 demo 用户,让测试者开箱即用。 */
const DEMO_PHONE = "13800138000";

export function App() {
  const theme = useThemeStore((s) => s.theme);
  const lang = useLangStore((s) => s.lang);
  const token = useAuthStore((s) => s.token);
  const setToken = useAuthStore((s) => s.setToken);
  const setUser = useAuthStore((s) => s.setUser);
  // 只在 mock auth 模式下需要做自动登录 demo 用户的引导。真实鉴权时跳过。
  const autoLoginEligible = USE_MOCK && !USE_REAL_AUTH && !token;
  const [bootstrapping, setBootstrapping] = useState<boolean>(autoLoginEligible);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", isRTL(lang) ? "rtl" : "ltr");
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    // 如果用户主动跳到 /login(比如退出登录后),不要再自动给他登成 demo —— 否则用户永远进不到登录页
    const onLoginRoute = typeof window !== "undefined" && window.location.pathname === "/login";
    if (autoLoginEligible && !onLoginRoute) {
      // 任意一个 6 位数字当 mock 验证码就行,mockSendSms 不真校验
      loginPhone(DEMO_PHONE, "123456", true)
        .then((r) => {
          if (cancelled) return;
          setToken(r.token);
          setUser(r.user);
        })
        .catch((e) => console.warn("[demo auto-login] failed", e))
        .finally(() => {
          if (!cancelled) setBootstrapping(false);
        });
    } else {
      setBootstrapping(false);
    }
    return () => {
      cancelled = true;
    };
    // 只在首次挂载时跑一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (bootstrapping) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--bg)",
          color: "var(--text-tertiary)",
          fontSize: 13,
          fontFamily: "var(--font-mono)",
        }}
      >
        {t("正在初始化 demo 账户…")}
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {/* sticky footer 布局:页面内容撑满,IcpFooter 永远在视口底部或内容底部 */}
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <RouterProvider router={router} />
        </div>
        <IcpFooter />
      </div>
      <Lightbox />
    </QueryClientProvider>
  );
}

/**
 * ICP 备案号底部信息栏
 *
 * 工信部要求:大陆服务器上的网站必须在底部显示 ICP 备案号 + 链接到 beian.miit.gov.cn
 * 不显示或链接错误可能导致备案被撤销 / 网站被关停。
 *
 * 因此放在 App 根容器作 sticky footer,所有页面(包括登录页 / 业务页)都可见。
 */
function IcpFooter() {
  return (
    <footer
      style={{
        flex: "0 0 auto",
        padding: "14px 16px",
        textAlign: "center",
        fontSize: 12,
        color: "var(--text-tertiary, #6b7280)",
        borderTop: "1px solid var(--border, rgba(255,255,255,.06))",
        background: "var(--bg)",
        lineHeight: 1.6,
      }}
    >
      <a
        href="https://beian.miit.gov.cn"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: "inherit",
          textDecoration: "none",
          opacity: 0.85,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.textDecoration = "underline";
          (e.currentTarget as HTMLElement).style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.textDecoration = "none";
          (e.currentTarget as HTMLElement).style.opacity = "0.85";
        }}
      >
        粤ICP备2025378786号
      </a>
    </footer>
  );
}
