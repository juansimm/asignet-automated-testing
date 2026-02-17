-- CreateTable
CREATE TABLE "Target" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetId" TEXT NOT NULL,
    "suiteName" TEXT NOT NULL,
    "mode" TEXT,
    "slowMoMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "exitCode" INTEGER,
    "stdoutPath" TEXT,
    "stderrPath" TEXT,
    "reportJsonPath" TEXT,
    "htmlReportPath" TEXT,
    "artifactsDir" TEXT,
    "total" INTEGER,
    "passed" INTEGER,
    "failed" INTEGER,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Run_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Run_targetId_idx" ON "Run"("targetId");

-- CreateIndex
CREATE INDEX "Run_status_idx" ON "Run"("status");

-- CreateIndex
CREATE INDEX "Run_createdAt_idx" ON "Run"("createdAt");
