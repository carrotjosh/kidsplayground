/**
 * 临时脚本：这个沙盒环境无法直连 Postgres 的 5432 端口（prisma migrate 的 schema-engine
 * 需要直连），但我们自己的 Prisma Client 走的是 Neon serverless driver（WebSocket/HTTPS），
 * 端口不受限。这个脚本借用同一个 Prisma Client 连接，把迁移 SQL 手动跑一遍，
 * 并在 _prisma_migrations 表里正确记一笔，这样以后 Vercel 构建时跑 `prisma migrate deploy`
 * 会认出这条迁移已经应用过，不会重复执行。
 *
 * 用法：npx tsx scripts/apply-migration-via-http.ts prisma/migrations/<folder>
 * 用完可以删掉这个脚本，不是长期要维护的东西。
 */
import "dotenv/config";

import { createHash, randomUUID } from "crypto";
import { readFileSync } from "fs";
import { basename, join } from "path";

import { prisma } from "../src/lib/db";

async function main() {
  const migrationDir = process.argv[2];
  if (!migrationDir) {
    throw new Error("用法: tsx scripts/apply-migration-via-http.ts prisma/migrations/<folder>");
  }

  const migrationName = basename(migrationDir);
  const sqlPath = join(migrationDir, "migration.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) NOT NULL,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
    );
  `);

  const already = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "_prisma_migrations" WHERE migration_name = $1 AND rolled_back_at IS NULL AND finished_at IS NOT NULL`,
    migrationName
  );
  if (already.length > 0) {
    console.log(`迁移 ${migrationName} 已经记录为已应用，跳过。`);
    return;
  }

  const sqlWithoutComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  const statements = sqlWithoutComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`共 ${statements.length} 条 SQL 语句，开始执行...`);
  let appliedCount = 0;
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
    appliedCount += 1;
    console.log(`  [${appliedCount}/${statements.length}] OK`);
  }

  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
     VALUES ($1, $2, $3, now(), now(), $4)`,
    id,
    checksum,
    migrationName,
    appliedCount
  );

  console.log(`迁移 ${migrationName} 应用完成，已记录到 _prisma_migrations。`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
