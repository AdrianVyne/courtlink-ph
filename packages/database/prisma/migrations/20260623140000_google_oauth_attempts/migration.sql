CREATE TABLE "google_oauth_attempts" (
    "stateHash" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "returnTo" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_oauth_attempts_pkey" PRIMARY KEY ("stateHash")
);

CREATE INDEX "google_oauth_attempts_expiresAt_idx" ON "google_oauth_attempts"("expiresAt");
