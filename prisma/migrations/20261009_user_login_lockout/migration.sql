-- 登录防爆破：连续失败次数和锁定截止时间落库（生产是 Vercel serverless，
-- 没有常驻进程能存内存计数器）。两列都带默认值，现有账号视为"从未失败过"。
ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP(3);
