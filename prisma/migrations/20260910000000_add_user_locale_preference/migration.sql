-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "localePreference" TEXT DEFAULT 'en';

-- Prefer USD for new accounts; leave existing rows untouched.
ALTER TABLE "User" ALTER COLUMN "currencyPreference" SET DEFAULT 'USD';
