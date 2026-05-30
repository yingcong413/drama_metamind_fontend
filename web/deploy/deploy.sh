#!/usr/bin/env bash
# 制影 AI 一键部署(在 ECS 服务器上执行)
#
# 使用方式:
#   1. 在本地 Mac:  cd web && bash deploy/pack.sh   → 生成 metamind-deploy.tar.gz
#   2. scp metamind-deploy.tar.gz root@<ECS_IP>:/root/
#   3. ssh root@<ECS_IP>
#   4. tar -xzf metamind-deploy.tar.gz -C /root/metamind-deploy
#   5. cd /root/metamind-deploy && sudo bash deploy.sh
#
# 脚本是幂等的:重复执行只会刷新静态文件 + reload nginx
#
set -euo pipefail

# ────────────────────────────────────────────────────────────
# 常量
# ────────────────────────────────────────────────────────────
APP_ROOT="/var/www/metamind"
SITE_NAME="metamind"
# nginx.org / Ubuntu 22.04+ 官方 nginx 都默认用 conf.d 结构;
# 跟旧 sites-available + sites-enabled 共存时会引发 listen 80 default_server 重复。
# 统一只用 conf.d/<site>.conf,顺手清理 sites-enabled 的同名 symlink。
NGINX_CONF="/etc/nginx/conf.d/${SITE_NAME}.conf"

# 脚本所在目录(包含 dist/ 和 nginx-metamind.conf)
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ────────────────────────────────────────────────────────────
# 0. 必须 root
# ────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    echo "[!] 请用 sudo / root 执行: sudo bash $0"
    exit 1
fi

# ────────────────────────────────────────────────────────────
# 1. 检查产物
# ────────────────────────────────────────────────────────────
if [[ ! -d "${HERE}/dist" ]]; then
    echo "[!] 找不到 ${HERE}/dist"
    echo "    请在本地 Mac 先执行: cd web && bash deploy/pack.sh"
    exit 1
fi
if [[ ! -f "${HERE}/nginx-metamind.conf" ]]; then
    echo "[!] 找不到 ${HERE}/nginx-metamind.conf"
    exit 1
fi

# ────────────────────────────────────────────────────────────
# 2. 安装 nginx(如未装)
# ────────────────────────────────────────────────────────────
if ! command -v nginx > /dev/null 2>&1; then
    echo "[*] 未发现 nginx,准备 apt 安装..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y nginx
else
    echo "[*] nginx 已存在:$(nginx -v 2>&1)"
fi

# 确保 conf.d 目录存在(nginx.org 包默认就有)
mkdir -p /etc/nginx/conf.d

# 关掉 nginx 自带的默认欢迎页(它监听 80,会跟我们冲突)
if [[ -f /etc/nginx/conf.d/default.conf ]]; then
    mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak
    echo "[*] 已禁用 nginx 默认站点(conf.d/default.conf → .bak)"
fi
# 顺手清掉历史遗留的 sites-enabled symlink(避免 listen 80 default_server 重复)
if [[ -L /etc/nginx/sites-enabled/${SITE_NAME} || -f /etc/nginx/sites-enabled/${SITE_NAME} ]]; then
    rm -f /etc/nginx/sites-enabled/${SITE_NAME}
    echo "[*] 已清理旧的 sites-enabled/${SITE_NAME}"
fi
if [[ -f /etc/nginx/sites-enabled/default ]]; then
    rm -f /etc/nginx/sites-enabled/default
fi

# ────────────────────────────────────────────────────────────
# 3. 部署静态文件
# ────────────────────────────────────────────────────────────
echo "[*] 同步前端产物到 ${APP_ROOT}"
mkdir -p "${APP_ROOT}"

# 备份上一版(便于回滚),保留最近 3 个
if [[ -d "${APP_ROOT}/index.html" ]] || [[ -f "${APP_ROOT}/index.html" ]]; then
    STAMP=$(date +%Y%m%d_%H%M%S)
    mkdir -p "/var/backups/metamind"
    tar -czf "/var/backups/metamind/${STAMP}.tar.gz" -C "${APP_ROOT}" . 2>/dev/null || true
    # 只保留最近 3 个备份
    ls -1t /var/backups/metamind/*.tar.gz 2>/dev/null | tail -n +4 | xargs -r rm -f
    echo "[*] 已备份旧版本到 /var/backups/metamind/${STAMP}.tar.gz"
fi

# 用 rsync 同步(没装 rsync 则 fallback 到 cp)
if command -v rsync > /dev/null 2>&1; then
    rsync -a --delete "${HERE}/dist/" "${APP_ROOT}/"
else
    rm -rf "${APP_ROOT:?}/"*
    cp -r "${HERE}/dist/." "${APP_ROOT}/"
fi

# 让 nginx 用户能读
chown -R www-data:www-data "${APP_ROOT}"
find "${APP_ROOT}" -type d -exec chmod 755 {} \;
find "${APP_ROOT}" -type f -exec chmod 644 {} \;

# ────────────────────────────────────────────────────────────
# 4. 写入 nginx site 配置 (conf.d 结构,单一来源,杜绝重复)
# ────────────────────────────────────────────────────────────
echo "[*] 写入 nginx site 配置: ${NGINX_CONF}"
cp "${HERE}/nginx-metamind.conf" "${NGINX_CONF}"

# ────────────────────────────────────────────────────────────
# 5. 测试 + reload nginx
# ────────────────────────────────────────────────────────────
echo "[*] nginx -t 校验配置"
nginx -t

# 启动 / 重载
if systemctl is-active --quiet nginx; then
    echo "[*] systemctl reload nginx"
    systemctl reload nginx
else
    echo "[*] systemctl enable + start nginx"
    systemctl enable nginx
    systemctl start nginx
fi

# ────────────────────────────────────────────────────────────
# 6. 自检
# ────────────────────────────────────────────────────────────
echo
echo "[*] 自检:"
sleep 1
curl -fsS http://127.0.0.1/healthz && echo "   ✓ /healthz 通过"
curl -fsSI http://127.0.0.1/ | head -1 || echo "   (注意确认上面 HTTP 200)"

# 取公网 IP(阿里云有 metadata 服务,不可用则用 ifconfig.me)
PUBLIC_IP=$(curl -fsS --max-time 2 http://100.100.100.200/latest/meta-data/eipv4 2>/dev/null \
            || curl -fsS --max-time 3 https://ifconfig.me 2>/dev/null \
            || echo "<ECS_PUBLIC_IP>")

echo
echo "─────────────────────────────────────────────"
echo "✓ 部署完成"
echo "  访问地址: http://${PUBLIC_IP}/"
echo "─────────────────────────────────────────────"
echo
echo "如果浏览器访问不到,检查:"
echo "  1. 阿里云控制台 → ECS → 安全组 → 入方向放行 TCP/80"
echo "  2. systemctl status nginx"
echo "  3. tail -f /var/log/nginx/error.log"
echo
