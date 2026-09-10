-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('AVAILABLE', 'CAUGHT', 'FLED');

-- CreateTable
CREATE TABLE "DailyEncounter" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "slot" INTEGER NOT NULL,
    "speciesId" INTEGER NOT NULL,
    "nameZh" TEXT NOT NULL,
    "types" TEXT[],
    "rarity" INTEGER NOT NULL,
    "artUrl" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "ability" TEXT NOT NULL,
    "moveName" TEXT NOT NULL,
    "movePower" INTEGER NOT NULL,
    "hp" INTEGER NOT NULL,
    "attack" INTEGER NOT NULL,
    "defense" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "isShiny" BOOLEAN NOT NULL DEFAULT false,
    "attemptsUsed" INTEGER NOT NULL DEFAULT 0,
    "status" "EncounterStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyEncounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyEncounter_childId_date_idx" ON "DailyEncounter"("childId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyEncounter_childId_date_slot_key" ON "DailyEncounter"("childId", "date", "slot");

-- AddForeignKey
ALTER TABLE "DailyEncounter" ADD CONSTRAINT "DailyEncounter_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
