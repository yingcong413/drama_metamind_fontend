import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

// `vite build --mode singlefile` 把整个前端打成一个自包含 index.html
// (mock 数据 + hash 路由 + 自动登录 demo),测试者双击即可用,无需后端/服务器。
export default defineConfig(({ mode }) => ({
  base: mode === "singlefile" ? "./" : "/",
  plugins: [react(), ...(mode === "singlefile" ? [viteSingleFile()] : [])],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      // Seedance (new-api 中转,真实接口) 反向代理 — 浏览器侧绕 CORS
      // 真实接口由 docs/test_seedance2_e/seedance2_final.py 验证
      "/seedance-proxy": {
        target: "http://101.37.232.133",
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/seedance-proxy/, ""),
      },
      // SeeGen 素材库(角色库上传 — CreateAssetGroup / CreateAsset / GetAsset)
      // 浏览器 fetch https://api.seegen.ai 会被 CORS 拦,统一走代理。
      // Authorization 头由前端 seegen.ts 注入(VITE_SEEGEN_API_KEY 或 BUILTIN),
      // 代理透传到上游。参考脚本: docs/seedance_sucai/upload_seegen_assets.py
      "/seegen-proxy": {
        target: "https://api.seegen.ai",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/seegen-proxy/, ""),
      },
      // metamind.ltd —— AI 助手(gpt-5.4 文本 / gpt-image-2 出图),OpenAI 兼容网关
      // 浏览器直连会被 CORS 拦,统一走代理;Authorization 由前端 api/metamind.ts 注入
      "/metamind-proxy": {
        target: "https://www.metamind.ltd",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/metamind-proxy/, ""),
      },
    },
  },
}));
