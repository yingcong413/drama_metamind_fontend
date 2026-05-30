#!/usr/bin/env bash
# 本地 Mac 打包脚本 — 在 web/ 目录下执行:
#   bash deploy/pack.sh
# 产物: web/deploy/metamind-deploy.tar.gz  (含 dist/, nginx-metamind.conf, deploy.sh, README.md)
set -euo pipefail

# 切到 web/(脚本目录的上一级)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${WEB_DIR}"

# 默认走真实接口模式(.env.production:VITE_USE_MOCK=false)。
# 想发 mock 版(无后端纯前端 demo),用 PACK_MODE=preview bash deploy/pack.sh
MODE="${PACK_MODE:-production}"
if [[ "${MODE}" == "preview" ]]; then
    echo "[1/3] 构建前端(VITE_USE_MOCK=true, mock 模式)..."
    npm run build:preview
else
    echo "[1/3] 构建前端(VITE_USE_MOCK=false, 接真后端)..."
    npm run build
fi

if [[ ! -d "${WEB_DIR}/dist" ]]; then
    echo "[!] 构建后没找到 dist/,中止"
    exit 1
fi

echo "[2/3] 整理部署目录 ${SCRIPT_DIR}/staging/"
STAGING="${SCRIPT_DIR}/staging"
rm -rf "${STAGING}"
mkdir -p "${STAGING}"
cp -R "${WEB_DIR}/dist" "${STAGING}/dist"
cp "${SCRIPT_DIR}/nginx-metamind.conf" "${STAGING}/"
cp "${SCRIPT_DIR}/deploy.sh"            "${STAGING}/"
cp "${SCRIPT_DIR}/README.md"            "${STAGING}/"
chmod +x "${STAGING}/deploy.sh"

echo "[3/3] tar.gz 归档..."
TARBALL="${SCRIPT_DIR}/metamind-deploy.tar.gz"
tar -czf "${TARBALL}" -C "${STAGING}" .
rm -rf "${STAGING}"

SIZE=$(du -h "${TARBALL}" | awk '{print $1}')
echo
echo "─────────────────────────────────────────────"
echo "✓ 打包完成: ${TARBALL} (${SIZE})"
echo "─────────────────────────────────────────────"
echo
echo "下一步:"
echo "  scp ${TARBALL} root@<ECS_PUBLIC_IP>:/root/"
echo "  ssh root@<ECS_PUBLIC_IP>"
echo "  mkdir -p /root/metamind-deploy && tar -xzf /root/metamind-deploy.tar.gz -C /root/metamind-deploy"
echo "  cd /root/metamind-deploy && sudo bash deploy.sh"
