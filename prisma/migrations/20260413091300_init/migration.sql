-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "privyUserId" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "walletAddress" TEXT,
    "onboardingCompletedAt" DATETIME,
    "idrxUserId" INTEGER,
    "idrxApiKeyEnc" TEXT,
    "idrxApiSecretEnc" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MintRequestSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "reference" TEXT,
    "merchantOrderId" TEXT,
    "toBeMinted" TEXT,
    "paymentAmount" TEXT,
    "paymentUrl" TEXT,
    "networkChainId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MintRequestSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_privyUserId_key" ON "User"("privyUserId");
