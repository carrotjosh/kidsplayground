# 部署到 Oracle Cloud 永久免费服务器

全程 0 元：Oracle Cloud 的 Always Free ARM 机器 + DuckDNS 免费域名 + Let's Encrypt 免费证书。

为什么选这套（都是实测过的结论）：

- Vercel 在公司网络被 sinkhole 拦截、国内也打不开 → 排除
- Cloudflare Workers 免费版限制每请求 10ms CPU，本项目实测最轻的页面就要 21ms → 排除
- Netlify 国内打不开 → 排除
- Oracle Cloud 公司网络和国内都能访问，且是完整虚拟机，没有 CPU / 请求数限制

---

## 第一步：开一台 Oracle 免费服务器

1. 注册 https://cloud.oracle.com （要信用卡验证，会预授权约 $1 后退回；**注册时"家园区域"选 Singapore 或 Tokyo**，选定后不能改）
2. 控制台 → Compute → Instances → Create instance
   - **Image**：Ubuntu 24.04（Canonical Ubuntu）
   - **Shape**：点 Change shape → Ampere → `VM.Standard.A1.Flex`，配 **2 OCPU / 12 GB**
     （Always Free 额度是 4 OCPU / 24 GB，留一半余量以后能再开一台；这个应用 2 核绰绰有余）
   - **SSH keys**：选 "Paste public key"，粘贴你自己的公钥（没有就选 Generate 并下载私钥保管好）
   - 其他默认，Create

   > 如果报 **"Out of host capacity"**：这是免费 ARM 实例最常见的问题，说明该区域暂时没库存。
   > 换个可用域（AD-1/2/3）重试，或者隔几小时再试。这是常态，不是你操作错了。

3. 实例创建好后记下 **Public IP address**

4. **放行 80/443 端口**（这一步不做的话外网永远连不上）：
   实例详情页 → Virtual Cloud Network → Security Lists → Default Security List → Add Ingress Rules
   - Source CIDR `0.0.0.0/0`，IP Protocol `TCP`，Destination Port Range `80`
   - 再加一条，端口 `443`

## 第二步：申请免费域名

1. 打开 https://www.duckdns.org ，用 GitHub / Google 登录
2. 在 "domains" 框里填一个名字（比如 `pengpeng-checkin`），点 add domain
3. 记下页面顶部的 **token**

拿到的域名就是 `pengpeng-checkin.duckdns.org`。

## 第三步：把代码和配置放上去

SSH 登录服务器（用户名固定是 `ubuntu`）：

```bash
ssh ubuntu@<你的公网IP>
```

拉代码：

```bash
sudo apt-get update && sudo apt-get install -y git
git clone <你的仓库地址> ~/kid-checkin
cd ~/kid-checkin
```

创建两个配置文件。第一个是应用的环境变量：

```bash
cat > ~/kid-checkin/.env <<'EOF'
DATABASE_URL="你的 Neon 新加坡连接串"
SESSION_SECRET="用 openssl rand -hex 32 生成的随机串"
EOF
chmod 600 ~/kid-checkin/.env
```

第二个是域名相关（注意 `SITE_DOMAIN` 要写完整域名）：

```bash
cat > ~/kid-checkin/deploy/duckdns.env <<'EOF'
DUCKDNS_SUBDOMAIN=pengpeng-checkin
DUCKDNS_TOKEN=你的 duckdns token
SITE_DOMAIN=pengpeng-checkin.duckdns.org
EOF
chmod 600 ~/kid-checkin/deploy/duckdns.env
```

## 第四步：一键部署

```bash
cd ~/kid-checkin && bash deploy/setup.sh
```

脚本会自动完成：装 Node.js 24 和 Caddy → 放行防火墙 → 构建 → 配好 DuckDNS 定时更新 →
Caddy 自动申请 Let's Encrypt 证书 → 把应用注册成开机自启的 systemd 服务 → 自检。

跑完打开 `https://你的域名.duckdns.org` 就能用了。

> 首次访问会跳到 `/setup` 引导你创建家长账号。建完之后注册入口自动关闭。

---

## 日常运维

```bash
# 看应用日志
sudo journalctl -u kid-checkin -f

# 看 Caddy（证书/HTTPS）日志
sudo journalctl -u caddy -f

# 重启应用
sudo systemctl restart kid-checkin

# 更新到最新代码
cd ~/kid-checkin && bash deploy/update.sh
```

## 排错

| 症状 | 原因 / 处理 |
|---|---|
| 外网打不开，但 `curl localhost:3000` 正常 | 云控制台的 Security List 没放行 80/443，见第一步第 4 点 |
| 证书申请失败 | 域名还没解析到这台机器。先 `dig +short 你的域名.duckdns.org` 确认返回的是本机公网 IP，再 `sudo systemctl restart caddy` |
| 创建实例报 Out of host capacity | 免费 ARM 库存不足，换可用域或隔几小时重试 |
| 应用起不来 | `sudo journalctl -u kid-checkin -n 50`，多半是 `.env` 里的 `DATABASE_URL` 写错了 |
| Oracle 说要回收闲置实例 | Always Free 的机器如果长期 CPU 极低可能被标记。这个应用有定时任务会持续产生流量，一般不会触发 |
