-- CreateTable
CREATE TABLE "SolverTelemetry" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "primaryCorrect" BOOLEAN NOT NULL,
    "primaryAnswer" TEXT,
    "sidecar1Answer" TEXT,
    "sidecar2Answer" TEXT,
    "sidecar1Correct" BOOLEAN,
    "sidecar2Correct" BOOLEAN,
    "challengeLength" INTEGER NOT NULL,
    "solveTimeMs" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolverTelemetry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolverTelemetry_model_idx" ON "SolverTelemetry"("model");

-- CreateIndex
CREATE INDEX "SolverTelemetry_createdAt_idx" ON "SolverTelemetry"("createdAt");
