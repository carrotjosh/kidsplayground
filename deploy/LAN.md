# 局域网部署（最轻量）

只在家里用：应用跑在家里一台电脑上，希沃平板和手机连同一个 WiFi 就能访问。
不需要域名、不需要证书、不需要云服务器、不需要备案。

> **前提**：这台电脑开着的时候才能用；你在公司访问不了。
> 如果需要随时随地都能审核，看 [README.md](README.md) 的 Oracle Cloud 方案。

数据库仍然用云端的 Neon（新加坡），所以这台电脑要能上网。好处是数据自动在云上，
以后想换成公网部署，数据不用搬。

---

## 一、准备（只做一次）

在那台要跑服务的电脑上：

1. 装 **Node.js 22 或更高**：https://nodejs.org （下载 LTS 版）
2. 装 **Git**：https://git-scm.com/downloads
3. 拉代码并安装依赖：

   ```bash
   git clone <你的仓库地址> kid-checkin
   cd kid-checkin
   npm install
   ```

4. 在项目根目录建 `.env` 文件，三行：

   ```bash
   DATABASE_URL="你的 Neon 新加坡连接串"
   SESSION_SECRET="用 openssl rand -hex 32 生成的随机串"
   ALLOW_INSECURE_COOKIES=1
   ```

   > 想让别人也在这台机器上注册账号，不用改配置——登录后在 `/admin/tenants`
   > 点「生成一个邀请码」即可。没有未使用的码时注册是关闭的。

   > `ALLOW_INSECURE_COOKIES=1` 这行**局域网部署必须加**。
   > 生产模式默认只在 HTTPS 下发送登录 Cookie，而局域网走的是 `http://192.168.x.x`，
   > 不加这行就会一直卡在登录页。公网部署时**不要**加。

5. 构建一次：

   ```bash
   npm run build
   ```

## 二、启动

```bash
npm run start:lan
```

看到 `Ready` 就成功了。终端会打印监听地址。

## 三、找到这台电脑的局域网 IP

- **Windows**：`ipconfig`，看"IPv4 地址"，形如 `192.168.1.5`
- **macOS**：`ipconfig getifaddr en0`
- **Linux**：`hostname -I | awk '{print $1}'`

## 四、放行防火墙

- **Windows**：第一次启动时会弹窗问"是否允许 Node.js 通过防火墙"，勾上**专用网络**，点允许。
  没弹窗的话：控制面板 → Windows Defender 防火墙 → 允许应用通过防火墙 → 找到 Node.js 勾上专用网络。
- **macOS**：系统设置 → 网络 → 防火墙，若开启则允许 node 接受连接。
- **Linux**：`sudo ufw allow 3000/tcp`

## 五、在平板/手机上打开

同一个 WiFi 下，浏览器访问：

```
http://<上面查到的IP>:3000
```

第一次会引导你创建家长账号。

**给蓬蓬的平板做设置**：在平板上打开这个地址 → 登录时**勾选「这是孩子的设备」** →
登录后落到 `/kid` → 用浏览器的「添加到主屏幕」生成桌面图标。以后点图标直接进，一年不用再登录。

---

## 让它开机自启（可选）

### Windows

按 `Win + R`，输入 `shell:startup` 回车，在打开的文件夹里新建一个 `打卡系统.bat`：

```bat
@echo off
cd /d C:\你的路径\kid-checkin
npm run start:lan
```

想让它在后台静默运行（不弹黑窗口），把上面那行换成：

```bat
powershell -WindowStyle Hidden -Command "cd 'C:\你的路径\kid-checkin'; npm run start:lan"
```

### macOS / Linux

用 `pm2` 最省事：

```bash
npm install -g pm2
pm2 start npm --name kid-checkin -- run start:lan
pm2 save
pm2 startup        # 按提示复制粘贴它输出的那行命令
```

---

## 固定 IP（强烈建议）

路由器给电脑分配的 IP 可能会变，一变平板上的桌面图标就失效了。
去路由器管理页面找「DHCP 静态地址分配」/「IP 与 MAC 绑定」，把这台电脑固定到一个 IP。

## 更新代码

```bash
git pull
npm install
npm run build
# 然后重启服务（Ctrl+C 后重新 npm run start:lan，或 pm2 restart kid-checkin）
```

## 排错

| 症状 | 处理 |
|---|---|
| 平板打不开，电脑上 `localhost:3000` 正常 | 防火墙没放行，或没用 `start:lan`（普通 `npm start` 只监听本机） |
| 一直跳回登录页，登不进去 | `.env` 里少了 `ALLOW_INSECURE_COOKIES=1` |
| 提示连不上数据库 | 这台电脑要能上外网（数据库在 Neon 新加坡） |
| 昨天还能用，今天平板打不开 | 电脑的局域网 IP 变了，看上面「固定 IP」 |
