#!/bin/bash
# 自动启动 Vite 开发服务器
cd "$(dirname "$0")"
echo "===== 进入项目目录: $(pwd) ====="
echo "===== 启动 npm run dev (vite 5) ====="
npm run dev
