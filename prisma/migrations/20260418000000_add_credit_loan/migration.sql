-- CreateTable
CREATE TABLE "CreditLoan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "collateralRaw" TEXT NOT NULL,
    "borrowRaw" TEXT NOT NULL,
    "lockTxHash" TEXT NOT NULL,
    "borrowTxHash" TEXT NOT NULL,
    "settleTxHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditLoan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditLoan_userId_idx" ON "CreditLoan"("userId");

-- CreateIndex
CREATE INDEX "CreditLoan_walletAddress_idx" ON "CreditLoan"("walletAddress");

-- AddForeignKey
ALTER TABLE "CreditLoan" ADD CONSTRAINT "CreditLoan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
