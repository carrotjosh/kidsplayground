import "dotenv/config";

import { hashPassword } from "../src/lib/auth";
import { seedDefaultsForChild } from "../src/lib/bootstrap";
import { prisma } from "../src/lib/db";

/**
 * 开发用种子数据：一个家长账号 + 一个孩子 + 默认的任务模板/礼物/植物。
 *
 * Child.userId 是必填的（多租户下"无主的孩子"会绕过所有归属校验），
 * 所以这里先保证有个账号，再把孩子挂上去。
 * 默认数据调 lib/bootstrap 里那份，和家长在后台新建孩子走的是同一套。
 */
const DEV_EMAIL = "dev@example.com";
const DEV_PASSWORD = "changeme123";

async function main() {
  // 已经有账号就复用第一个（通常是你自己的），不要凭空多造一个租户出来。
  const existing = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  const user =
    existing ??
    (await prisma.user.create({
      data: {
        email: DEV_EMAIL,
        passwordHash: await hashPassword(DEV_PASSWORD),
        isSuperAdmin: true, // 系统第一个账号 = 运维者
      },
    }));

  const child = await prisma.child.upsert({
    where: { slug: "pengpeng-demo" },
    update: { name: "蓬蓬" },
    create: { name: "蓬蓬", slug: "pengpeng-demo", userId: user.id },
  });

  await seedDefaultsForChild(child.id);

  console.log(`账号：${user.email}${existing ? "（复用已有账号）" : `，初始密码 ${DEV_PASSWORD}`}`);
  console.log(`孩子：${child.name}，孩子端链接 /kid/${child.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
