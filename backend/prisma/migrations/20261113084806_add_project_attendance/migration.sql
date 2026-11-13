-- CreateTable
CREATE TABLE "ProjectAttendance" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "workDate" DATE NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectAttendance_employeeId_workDate_idx" ON "ProjectAttendance"("employeeId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAttendance_taskId_employeeId_workDate_key" ON "ProjectAttendance"("taskId", "employeeId", "workDate");

-- AddForeignKey
ALTER TABLE "ProjectAttendance" ADD CONSTRAINT "ProjectAttendance_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAttendance" ADD CONSTRAINT "ProjectAttendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
