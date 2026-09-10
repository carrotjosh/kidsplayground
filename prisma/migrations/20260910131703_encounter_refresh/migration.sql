-- AlterEnum
ALTER TYPE "LedgerType" ADD VALUE 'POKEDEX_REFRESH';

-- AlterTable
ALTER TABLE "DailyEncounter" ADD COLUMN     "refreshRound" INTEGER NOT NULL DEFAULT 0;
