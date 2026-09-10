-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('WEEKDAYS', 'WORKDAY', 'HOLIDAY');

-- AlterTable
ALTER TABLE "TaskTemplate" ADD COLUMN     "scheduleType" "ScheduleType" NOT NULL DEFAULT 'WEEKDAYS';
