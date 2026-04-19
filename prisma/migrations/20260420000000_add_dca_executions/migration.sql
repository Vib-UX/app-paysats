-- CreateTable
CREATE TABLE "DcaExecution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" TEXT NOT NULL,
    "idrxSpentRaw" TEXT NOT NULL,
    "cbBtcReceivedRaw" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DcaExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DcaExecution_walletAddress_txHash_key" ON "DcaExecution"("walletAddress", "txHash");

-- CreateIndex
CREATE INDEX "DcaExecution_userId_idx" ON "DcaExecution"("userId");

-- CreateIndex
CREATE INDEX "DcaExecution_walletAddress_blockNumber_idx" ON "DcaExecution"("walletAddress", "blockNumber");

-- AddForeignKey
ALTER TABLE "DcaExecution" ADD CONSTRAINT "DcaExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
