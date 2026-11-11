CREATE TABLE "MailOutbox" (
  "id" UUID NOT NULL,
  "ciphertext" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MailOutbox_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MailOutbox_attempts_nextAttemptAt_idx" ON "MailOutbox"("attempts", "nextAttemptAt");
CREATE TABLE "LoginAttempt" (
  "key" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "windowStartedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "LoginAttempt_windowStartedAt_idx" ON "LoginAttempt"("windowStartedAt");
