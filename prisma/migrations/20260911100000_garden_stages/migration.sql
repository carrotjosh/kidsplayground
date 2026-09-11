-- 花园分级：1 = 4×4 / 2 = 5×5 / 3 = 6×6
ALTER TABLE "Child" ADD COLUMN "gardenStage" INTEGER NOT NULL DEFAULT 1;
