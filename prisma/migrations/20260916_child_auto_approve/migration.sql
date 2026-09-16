-- 自动审批开关：孩子点「做完了」是否直接到账，不用家长确认。
-- 默认 false，现有孩子行为不变。
ALTER TABLE "Child" ADD COLUMN "autoApprove" BOOLEAN NOT NULL DEFAULT false;
