-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- 系统里已有的第一个账号就是运维者，给它超管权限。
-- 用子查询而不是写死 id，这样这条迁移在任何一份数据库上跑都成立（包括别人 clone 之后自己建的库）。
UPDATE "User" SET "isSuperAdmin" = true
WHERE "id" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1);

-- 兜底：真有无主的孩子就挂到第一个账号名下，否则下面的 SET NOT NULL 会失败。
-- 当前库里是 0 条，这句只是让迁移在别的环境上也不会炸。
UPDATE "Child" SET "userId" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "userId" IS NULL;

-- DropForeignKey
ALTER TABLE "Child" DROP CONSTRAINT "Child_userId_fkey";

-- AlterTable
ALTER TABLE "Child" ALTER COLUMN "userId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
