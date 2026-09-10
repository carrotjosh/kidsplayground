-- CreateEnum
CREATE TYPE "KidTheme" AS ENUM ('GARDEN', 'POKEDEX');
CREATE TYPE "BallTier" AS ENUM ('POKE', 'GREAT', 'ULTRA', 'MASTER');
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');
CREATE TYPE "CaughtStatus" AS ENUM ('OWNED', 'FLED');

-- AlterEnum
ALTER TYPE "LedgerType" ADD VALUE 'BALL_BUY';
ALTER TYPE "LedgerType" ADD VALUE 'POKEDEX_BONUS';

-- AlterTable
ALTER TABLE "Child" ADD COLUMN "theme" "KidTheme" NOT NULL DEFAULT 'GARDEN';
ALTER TABLE "Child" ADD COLUMN "catchMissStreak" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PokemonSpecies" (
    "id" INTEGER NOT NULL,
    "nameZh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "types" TEXT[],
    "hp" INTEGER NOT NULL,
    "attack" INTEGER NOT NULL,
    "defense" INTEGER NOT NULL,
    "spAtk" INTEGER NOT NULL,
    "spDef" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "statTotal" INTEGER NOT NULL,
    "rarity" INTEGER NOT NULL,
    "genderRate" INTEGER NOT NULL,
    "isLegendary" BOOLEAN NOT NULL DEFAULT false,
    "abilities" TEXT[],
    "moveName" TEXT NOT NULL,
    "movePower" INTEGER NOT NULL,
    "artUrl" TEXT NOT NULL,
    CONSTRAINT "PokemonSpecies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PokemonSpecies_rarity_idx" ON "PokemonSpecies"("rarity");

CREATE TABLE "BallType" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "tier" "BallTier" NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT,
    "cost" INTEGER NOT NULL,
    "catchPower" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BallType_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BallType_childId_idx" ON "BallType"("childId");

CREATE TABLE "Caught" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
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
    "ballTypeId" TEXT,
    "ballTier" "BallTier" NOT NULL,
    "status" "CaughtStatus" NOT NULL DEFAULT 'OWNED',
    "caughtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caughtOnDate" DATE,
    "fledOnDate" DATE,
    CONSTRAINT "Caught_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Caught_childId_status_idx" ON "Caught"("childId", "status");
CREATE INDEX "Caught_childId_caughtOnDate_idx" ON "Caught"("childId", "caughtOnDate");

-- AddForeignKey
ALTER TABLE "BallType" ADD CONSTRAINT "BallType_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Caught" ADD CONSTRAINT "Caught_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Caught" ADD CONSTRAINT "Caught_ballTypeId_fkey" FOREIGN KEY ("ballTypeId") REFERENCES "BallType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
