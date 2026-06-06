# 制影 AI — 阿里云 ECS 部署包

把前端 demo 部署到一台 **Ubuntu / Debian** 阿里云 ECS,供他人通过公网 IP 在浏览器测试。

> 本部署仅供临时内测。**Seedance API Key 内联在前端 bundle 里**,任何打开 DevTools 的人都能看到,正式上线前请把鉴权改到后端代理。

---

## 一、整体架构

```
浏览器  ────►  http://<ECS_PUBLIC_IP>/        ┐
                                              │  nginx (ECS 上,本部署包负责装)
                                              ▼
       /                ─►  /var/www/metamind/        (静态 React 站)
       /seedance-proxy/* ─►  http://101.37.232.133/*  (Seedance 真实接口)
```

- 项目/角色数据走 **localStorage mock**(`VITE_USE_MOCK=true`),其他测试者打开页面时是空状态,可以自己建项目
- 想看默认 demo("雨夜的告别"),让测试者按 F12 → Console 执行 `localStorage.clear(); location.reload();` 即可重置回 mock 数据
- 视频生成走真实 Seedance API,nginx 把 `/seedance-proxy/*` 反代到 `http://101.37.232.133/*`

---

## 二、本地 Mac 打包

在 `web/` 目录下执行:

```bash
bash deploy/pack.sh
```

会自动:
1. `npm run build`(production 模式,默认)生成 `dist/`;`PACK_MODE=preview` 才用 `build:preview`
2. 把 `dist/` + nginx 配置 + deploy.sh + 本 README 打包成 `web/deploy/metamind-deploy.tar.gz`

---

## ⚠ 前端凭据是「构建期」变量 —— 必须放 `web/.env.local`,不是后端 `.env`

**最容易踩的坑**:所有 `VITE_*` 变量(`VITE_TOS_AK` / `VITE_TOS_SK` / `VITE_SEEGEN_API_KEY` / `VITE_METAMIND_API_KEY` / `VITE_ASSET_LIB_PROVIDER` 等)都是**前端构建期**变量 —— Vite 在 `npm run build` 时把它们的值**编译进前端 bundle**。

- ✅ 要放在**执行构建那台机器**的 `web/.env.local`(已 gitignore,不入仓库),或 `web/.env.production`(非密钥项)。
- ❌ 放到后端 `/opt/metamind-server/.env` **完全无效** —— 那是 Node 服务器**运行期**读的,跟已经打包好的前端静态 JS 没有任何关系。
- 典型症状:上传素材报「**TOS 凭据未配置:请在 web/.env.local 设置 VITE_TOS_AK / VITE_TOS_SK**」,就是构建时没注入这两个值。

**正确做法**(构建机 `web/` 目录):

```bash
cat > web/.env.local <<'EOF'
VITE_TOS_AK=你的火山AK
VITE_TOS_SK=你的火山SK
VITE_METAMIND_API_KEY=你的AI密钥
EOF
npm run build   # 这一步才会把上面的值打进 bundle
```

> 改了 `.env.local` **必须重新 `npm run build` 并重新部署** dist,旧 bundle 不会自动更新。
>
> 后端的 `server/.env`(`/opt/metamind-server/.env`)只放**后端运行期**变量:`JWT_SECRET` / `VOLCANO_*` / `ALIYUN_*` / OAuth / `BILLING_*` / `ALIPAY_*` / `WECHAT_PAY_*` 等。两套 env 各管各的,别混。
>
> 想彻底不在前端放密钥,可改走「后端代签」(复用后端 `VOLCANO_*`),届时前端就不需要 `VITE_TOS_*` 了。

---

## 三、上传到 ECS

```bash
# 替换 <ECS_PUBLIC_IP> 为你的阿里云公网 IP
scp deploy/metamind-deploy.tar.gz root@115.29.185.40:/root/
```
MetaMind666!
> 如果 ECS 用 key 登录:`scp -i ~/.ssh/your-key.pem ...`
> 如果 ECS 不允许 root 直连,换成 `ubuntu@` 或 `ecs-user@`,后续 deploy.sh 加 `sudo`

---

## 四、ECS 上一键部署

```bash
ssh root@115.29.185.40

# 解压到独立目录
mkdir -p /root/metamind-deploy
tar -xzf /root/metamind-deploy.tar.gz -C /root/metamind-deploy
cd /root/metamind-deploy

# 部署(脚本会装 nginx、写 site 配置、拷贝静态文件、reload)
sudo bash deploy.sh
```

脚本结束时会打印 `访问地址: http://<ECS_PUBLIC_IP>/`。

---

## 五、阿里云控制台:放行 80 端口

如果浏览器访问超时,99% 是安全组没开:

1. 阿里云控制台 → ECS 实例 → 进入实例详情
2. **安全组** → 配置规则 → **入方向** → **手动添加**
3. 协议类型 `TCP`,端口范围 `80/80`,授权对象 `0.0.0.0/0`(测试期),策略 `允许`
4. 保存,**无需重启 ECS**,立即生效

> 不需要开 443 除非后续配 HTTPS。

---

## 六、验证清单

部署完后挨条检查:

```bash
# 在 ECS 上
curl http://127.0.0.1/healthz         # 应返回 "ok"
curl -I http://127.0.0.1/              # 应返回 HTTP/1.1 200 OK
curl http://127.0.0.1/seedance-proxy/v1/video/generations/xxx -I   # 应返回 4xx(说明反代通了)

# 在你 Mac 上
curl -I http://<ECS_PUBLIC_IP>/        # 应返回 HTTP/1.1 200 OK
```

浏览器打开 `http://<ECS_PUBLIC_IP>/` 应该看到「填一次,贯穿整支视频」编辑器页面。

---

## 七、迭代发版

代码改完后,**只需重打包再上传**:

```bash
# Mac
bash deploy/pack.sh
scp web/deploy/metamind-deploy.tar.gz root@<ECS_PUBLIC_IP>:/root/

# ECS
tar -xzf /root/metamind-deploy.tar.gz -C /root/metamind-deploy
cd /root/metamind-deploy && sudo bash deploy.sh
```

`deploy.sh` 是幂等的:第二次跑会自动备份旧版本到 `/var/backups/metamind/<时间戳>.tar.gz`(只保留最近 3 个),然后用新文件覆盖。

---

## 八、回滚

```bash
ssh root@<ECS_PUBLIC_IP>
ls /var/backups/metamind/                                # 看可回滚的版本
tar -xzf /var/backups/metamind/<timestamp>.tar.gz -C /var/www/metamind --overwrite
systemctl reload nginx
```

---

## 九、常见排查

| 现象 | 排查 |
|---|---|
| 浏览器超时 | 阿里云安全组没开 80(见第五节) |
| 502 Bad Gateway | `tail -f /var/log/nginx/error.log` 看上游 `101.37.232.133` 是否能通,在 ECS 上 `curl -I http://101.37.232.133/v1/video/generations/xxx` 自测 |
| /editor 直接刷新 404 | nginx 配置里 SPA fallback 没生效,确认用的是 `try_files $uri $uri/ /index.html` |
| 生成视频按钮 401 | API key 失效,在 ECS 上 `grep -r "sk-" /var/www/metamind/assets/*.js` 看是不是空,需要重新打包 |
| 控制台 cookie 警告 | 无视,浏览器对跨域设置 cookie 的提醒 |

---

## 十、安全提示(正式上线前必看)

1. **API key**:目前在 bundle 里,任何人能扒。改造方案:
   - 在 nginx `/seedance-proxy/` location 里 `proxy_set_header Authorization "Bearer sk-..."`,前端不再发 Authorization
   - 同时前端 `seedance.ts` 的 `API_KEY` 改成空,`authHeaders()` 不发 Authorization
2. **HTTPS**:测试期可裸 HTTP,正式上线务必配 SSL。阿里云免费证书申请 → 域名解析 → nginx 加 443 server
3. **限流**:nginx 加 `limit_req` 防止恶意触发昂贵的视频生成调用
