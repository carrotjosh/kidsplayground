-- DropForeignKey
ALTER TABLE "Redemption" DROP CONSTRAINT "Redemption_rewardId_fkey";

-- AlterTable
ALTER TABLE "Reward" ADD COLUMN     "cooldownDays" INTEGER;

-- AlterTable
ALTER TABLE "Redemption" ALTER COLUMN "rewardId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
