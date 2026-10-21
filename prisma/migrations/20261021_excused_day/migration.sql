-- 请假日：家长标记「这天允许不打卡」（生病、出门）。
CREATE TABLE "ExcusedDay" (
  "id" TEXT NOT NULL,
  "childId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExcusedDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExcusedDay_childId_date_key" ON "ExcusedDay"("childId", "date");
ALTER TABLE "ExcusedDay" ADD CONSTRAINT "ExcusedDay_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
