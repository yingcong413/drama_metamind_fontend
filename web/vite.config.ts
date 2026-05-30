import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
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
    },
  },
});
