-- CreateTable
CREATE TABLE "AdminTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'P2',
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assignee" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "linearId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminTask_linearId_key" ON "AdminTask"("linearId");

-- CreateIndex
CREATE INDEX "AdminTask_status_idx" ON "AdminTask"("status");

-- CreateIndex
CREATE INDEX "AdminTask_priority_idx" ON "AdminTask"("priority");

-- CreateIndex
CREATE INDEX "AdminTask_assignee_idx" ON "AdminTask"("assignee");

-- CreateIndex
CREATE INDEX "AdminTask_createdAt_idx" ON "AdminTask"("createdAt");
