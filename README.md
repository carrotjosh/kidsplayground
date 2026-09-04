# 打卡小星星

一年级孩子的学习打卡 + 积分 + 礼物兑换系统。

- **孩子端**：`/kid/[孩子的slug]`，手机浏览器打开即可，查看今日任务、打卡、兑换礼物。
- **家长后台**：`/admin`，需要密码登录，管理任务模板、临时任务、积分、礼物、打卡记录、兑换记录。

技术栈：Next.js (App Router) + Prisma 7 + Neon Postgres（Serverless Postgres）+ Vercel 部署。

## 0. 准备账号（只需要做一次）

以下三个都是免费额度，用邮箱或 GitHub 账号注册即可：

1. **GitHub**（代码托管）：https://github.com/signup
2. **Neon**（云数据库）：https://neon.tech ，注册后新建一个项目，进入项目的 "Connection string" 页面，复制形如
   `postgresql://用户名:密码@xxx.neon.tech/数据库名?sslmode=require` 的连接串，这就是下面要用的 `DATABASE_URL`。
3. **Vercel**（部署托管）：https://vercel.com/signup ，建议直接用 GitHub 账号登录，方便后面一键导入仓库。

## 1. 本地开发环境搭建

### 1.1 配置环境变量

项目根目录已经有一个 `.env` 文件（由 `prisma init` 自动生成），打开它，确保包含下面三个变量（没有就手动加上）：

```bash
DATABASE_URL="上一步从 Neon 复制的连接串"
PARENT_PASSWORD="给家长后台设置的登录密码，自己定"
SESSION_SECRET="随便一串足够长的随机字符串，比如用 `openssl rand -hex 32` 生成"
```

`.env` 已经在 `.gitignore` 里，不会被提交到 git，可以放心写真实密码。

### 1.2 安装依赖 & 初始化数据库

```bash
npm install
npm run db:migrate      # 在 Neon 数据库里建表（首次运行会让你输入一个迁移名字，随便填比如 init）
npm run db:seed         # 创建一个示例孩子档案 + 示例任务模板 + 示例礼物
```

`db:seed` 跑完后，终端会打印出示例孩子的打卡链接，形如 `/kid/doudou-demo`，先用这个示例链接跑通全流程，正式使用前记得去家长后台把示例数据换成真实的。

> 如果执行 Prisma 相关命令时报 TLS/证书相关的错误，可以在命令前加上
> `NODE_OPTIONS="--use-system-ca"` 试试（部分公司网络环境下 Node 默认的证书库和系统证书库不一致导致的）。

### 1.3 启动本地开发服务器

```bash
npm run dev
```

打开 http://localhost:3000 ，会自动跳转到 `/admin`（未登录会再跳到登录页，输入上面设置的 `PARENT_PASSWORD` 登录）。

### 1.4 本地闭环走查清单

1. 登录家长后台 `/admin/login`。
2. 在"任务模板"页新建一个模板，分值设为 10，勾上"今天"对应的星期。
3. 打开孩子端链接 `/kid/[slug]`（隐身窗口模拟孩子视角），确认任务出现，点击"完成"，积分从 0 变成 10。
4. 家长后台"打卡记录"页能看到这条完成记录，"积分"页余额是 10。
5. "礼物"页新建一个礼物，所需积分设为 10。
6. 孩子端"礼物橱窗"里这个礼物可以点击兑换，兑换后积分变回 0。
7. 家长后台"兑换记录"页能看到这条申请，点"标记已兑现"。
8. 回到"打卡记录"，把第 3 步那条记录"撤销"，"积分"页能看到完整的 +10 完成 / -10 兑换 / -10 撤销 三条流水，逻辑自洽即代表闭环没问题。

## 2. 部署到 Vercel

1. 把代码推到 GitHub（新建一个私有仓库）：

   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin <你的仓库地址>
   git push -u origin main
   ```

2. 去 Vercel 网站 "Add New… → Project"，选择刚才的 GitHub 仓库导入。
3. 在 Vercel 项目的 Environment Variables 里配置三个变量（和本地 `.env` 里的一样）：
   `DATABASE_URL`、`PARENT_PASSWORD`、`SESSION_SECRET`。
4. 点 Deploy，等构建完成后会拿到一个 `https://xxx.vercel.app` 的线上地址。
5. 线上环境同样跑一遍 1.4 的走查清单（可以新建一个明确标记"测试"的任务/礼物，走完后在后台删除或停用）。

## 3. 正式投入使用

1. 登录线上 `/admin`，进入"任务模板"，把示例任务停用，换成孩子真实的每日任务。
2. 进入"礼物"，设置真实的礼物清单和所需积分。
3. 家长后台首页仪表盘顶部/数据库里能看到真实孩子的 slug 链接（也可以直接用 `db:seed` 生成的示例孩子改名字继续用，不需要重新建）。
4. 把孩子端链接 `/kid/[slug]` 发到孩子会用的设备浏览器上，用浏览器的"添加到主屏幕"功能生成桌面图标，之后孩子直接点桌面图标进入。

## 常用命令

```bash
npm run dev        # 本地开发
npm run build      # 生产构建（Vercel 部署时会自动跑）
npm run db:migrate # 修改 prisma/schema.prisma 之后同步数据库结构
npm run db:seed    # 重新跑一遍示例数据（对已有孩子不会重复插入）
npm run db:studio  # 打开 Prisma Studio 可视化查看/修改数据库数据
```

## 后续可以迭代的方向（第一版故意没做）

- 消息推送提醒（比如晚上提醒孩子还没打卡）。
- 家长审核打卡的二次确认流程。
- 礼物库存管理。
- 支持多个孩子（数据模型已经预留了 `childId`，加个孩子选择器即可）。
