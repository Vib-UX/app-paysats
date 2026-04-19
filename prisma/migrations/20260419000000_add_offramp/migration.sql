-- CreateTable
CREATE TABLE "PayoutDestination" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idrxId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankAccountName" TEXT NOT NULL,
    "bankAccountNumberEnc" TEXT NOT NULL,
    "bankAccountNumberLast" TEXT NOT NULL,
    "depositWalletAddress" TEXT NOT NULL,
    "maxAmountTransfer" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutDestination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayoutDestination_userId_idx" ON "PayoutDestination"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutDestination_userId_idrxId_key" ON "PayoutDestination"("userId", "idrxId");

-- AddForeignKey
ALTER TABLE "PayoutDestination" ADD CONSTRAINT "PayoutDestination_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "RedeemRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payoutDestinationId" TEXT NOT NULL,
    "transferTxHash" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "usdcAmountRaw" TEXT NOT NULL,
    "idrQuoteRaw" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "depositRedeemId" INTEGER,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedeemRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RedeemRequest_transferTxHash_key" ON "RedeemRequest"("transferTxHash");

-- CreateIndex
CREATE INDEX "RedeemRequest_userId_idx" ON "RedeemRequest"("userId");

-- CreateIndex
CREATE INDEX "RedeemRequest_payoutDestinationId_idx" ON "RedeemRequest"("payoutDestinationId");

-- AddForeignKey
ALTER TABLE "RedeemRequest" ADD CONSTRAINT "RedeemRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedeemRequest" ADD CONSTRAINT "RedeemRequest_payoutDestinationId_fkey" FOREIGN KEY ("payoutDestinationId") REFERENCES "PayoutDestination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
