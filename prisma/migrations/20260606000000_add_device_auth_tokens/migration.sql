-- AlterTable: per-user Privy device-authorization grant tokens (encrypted)
ALTER TABLE "User" ADD COLUMN     "privyDeviceAccessTokenEnc" TEXT,
ADD COLUMN     "privyDeviceAccessTokenExp" TIMESTAMP(3),
ADD COLUMN     "privyDeviceRefreshTokenEnc" TEXT;

-- AlterTable: map the pending authorization handle to a device/user code
ALTER TABLE "OAuthPendingAuth" ADD COLUMN     "deviceCode" TEXT,
ADD COLUMN     "userCode" TEXT;
