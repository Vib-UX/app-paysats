"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import {
  CBBTC_DECIMALS,
  USDC_DECIMALS,
  MAX_BORROW_LTV_RATIO,
  deriveCreditHealth,
  maxSafeBorrow,
  type SafetyZone,
} from "@/lib/contracts/morpho-credit";
import {
  useCreditPosition,
  useOpenCreditLine,
  useRepayCreditLine,
  useWithdrawCollateral,
  useCreditLoans,
  useCreateCreditLoan,
  useSettleCreditLoan,
  formatUsdc,
  formatCbBtc,
  type CreditLoanRecord,
} from "@/hooks/use-credit-line";
import { useLocale, useT } from "@/lib/i18n";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { CreditEducation } from "./credit-education";

// ---------------------------------------------------------------------------
// Safety meter
// ---------------------------------------------------------------------------

const ZONE_COLORS: Record<SafetyZone, { bar: string; text: string; bg: string }> = {
  safe: { bar: "bg-green-500", text: "text-green-700", bg: "bg-green-50" },
  warning: { bar: "bg-yellow-500", text: "text-yellow-700", bg: "bg-yellow-50" },
  danger: { bar: "bg-red-500", text: "text-red-700", bg: "bg-red-50" },
};

function SafetyMeter({
  score,
  zone,
  label,
}: {
  score: number;
  zone: SafetyZone;
  label: string;
}) {
  const t = useT();
  const colors = ZONE_COLORS[zone];
  const zoneKeys: Record<SafetyZone, Parameters<typeof t>[0]> = {
    safe: "credit.zoneSafe",
    warning: "credit.zoneWarning",
    danger: "credit.zoneDanger",
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-arka-text-muted">{label}</span>
        <span className={`font-semibold ${colors.text}`}>
          {t(zoneKeys[zone])}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-arka-border/40">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
          style={{ width: `${Math.max(4, score)}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Open credit flow
// ---------------------------------------------------------------------------

type OpenSuccessData = {
  lockTxHash: string;
  borrowTxHash: string;
  collateralRaw: string;
  borrowRaw: string;
};

function OpenCreditFlow({
  cbBtcBalance,
  oraclePrice,
  walletAddress,
  onSuccess,
}: {
  cbBtcBalance: bigint;
  oraclePrice: bigint;
  walletAddress: string;
  onSuccess: (data: OpenSuccessData) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const localeStr = locale === "id" ? "id-ID" : "en-US";

  const [collateralPct, setCollateralPct] = useState(100);
  const [borrowPct, setBorrowPct] = useState(50);

  const collateralAmount = useMemo(
    () => (cbBtcBalance * BigInt(collateralPct)) / BigInt(100),
    [cbBtcBalance, collateralPct],
  );

  const maxBorrow = useMemo(
    () => maxSafeBorrow(collateralAmount, oraclePrice),
    [collateralAmount, oraclePrice],
  );

  const borrowAmount = useMemo(
    () => (maxBorrow * BigInt(borrowPct)) / BigInt(100),
    [maxBorrow, borrowPct],
  );

  const previewHealth = useMemo(
    () => deriveCreditHealth(collateralAmount, oraclePrice, borrowAmount),
    [collateralAmount, oraclePrice, borrowAmount],
  );

  const { open, busy, error, borrowTxHash } = useOpenCreditLine();
  const createLoan = useCreateCreditLoan();

  const handleOpen = useCallback(async () => {
    if (borrowAmount <= BigInt(0) || collateralAmount <= BigInt(0)) return;
    const result = await open({ collateralAmount, borrowAmount });
    if (result) {
      createLoan({
        walletAddress,
        collateralRaw: collateralAmount.toString(),
        borrowRaw: borrowAmount.toString(),
        lockTxHash: result.lockTxHash,
        borrowTxHash: result.borrowTxHash,
      });
      onSuccess({
        lockTxHash: result.lockTxHash,
        borrowTxHash: result.borrowTxHash,
        collateralRaw: collateralAmount.toString(),
        borrowRaw: borrowAmount.toString(),
      });
    }
  }, [open, createLoan, collateralAmount, borrowAmount, walletAddress, onSuccess]);

  if (borrowTxHash) {
    return (
      <Card className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">
          ✓
        </div>
        <p className="text-sm font-semibold text-arka-text">
          {t("credit.successTitle")}
        </p>
        <p className="mt-1 text-xs text-arka-text-muted">
          {t("credit.successDesc")}
        </p>
        <a
          href={`https://basescan.org/tx/${borrowTxHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs font-medium text-arka-accent hover:underline"
        >
          {t("credit.viewBasescan")}
        </a>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="mb-3 text-sm font-medium text-arka-text">
          {t("credit.openDesc")}
        </p>

        {/* Collateral slider */}
        <label className="text-xs font-medium text-arka-text-muted">
          {t("credit.lockLabel")}
        </label>
        <div className="mt-1 flex items-center gap-3">
          <input
            type="range"
            min={10}
            max={100}
            step={1}
            value={collateralPct}
            onChange={(e) => setCollateralPct(Number(e.target.value))}
            className="flex-1 accent-arka-accent"
          />
          <span className="w-24 text-right font-mono text-sm text-arka-text">
            {formatCbBtc(collateralAmount, localeStr)} BTC
          </span>
        </div>

        {/* Borrow slider */}
        <label className="mt-4 block text-xs font-medium text-arka-text-muted">
          {t("credit.borrowLabel")}
        </label>
        <div className="mt-1 flex items-center gap-3">
          <input
            type="range"
            min={5}
            max={100}
            step={1}
            value={borrowPct}
            onChange={(e) => setBorrowPct(Number(e.target.value))}
            className="flex-1 accent-arka-accent"
          />
          <span className="w-28 text-right font-mono text-sm text-arka-text">
            ${formatUsdc(borrowAmount, localeStr)}
          </span>
        </div>
        <p className="mt-1 text-right text-[11px] text-arka-text-muted">
          {t("credit.maxBorrow")}: ${formatUsdc(maxBorrow, localeStr)}
        </p>
      </Card>

      {/* Safety preview */}
      <Card>
        <SafetyMeter
          score={previewHealth.safetyScore}
          zone={previewHealth.zone}
          label={t("credit.safetyLabel")}
        />
        <div className="mt-3 flex items-center justify-between text-xs text-arka-text-muted">
          <span>{t("credit.interestRate")}</span>
          <span className="font-medium text-arka-text">~4.5% {t("credit.aprNote")}</span>
        </div>
      </Card>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <Button
        onClick={handleOpen}
        disabled={busy || borrowAmount <= BigInt(0) || previewHealth.zone === "danger"}
      >
        {busy ? t("credit.confirmingBtn") : t("credit.confirmBtn")}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active position view
// ---------------------------------------------------------------------------

function ActivePosition({
  onRefresh,
  activeLoan,
  onLoanSettled,
}: {
  onRefresh: () => void;
  activeLoan?: CreditLoanRecord | null;
  onLoanSettled?: () => void;
}) {
  const { data } = useCreditPosition();
  const t = useT();
  const { locale } = useLocale();
  const localeStr = locale === "id" ? "id-ID" : "en-US";
  const [repayMode, setRepayMode] = useState(false);
  const [repayInput, setRepayInput] = useState("");

  const { repay, busy: repayBusy, error: repayError, txHash: repayTx } =
    useRepayCreditLine();
  const {
    withdraw,
    busy: withdrawBusy,
    error: withdrawError,
    txHash: withdrawTx,
  } = useWithdrawCollateral();
  const settleLoan = useSettleCreditLoan();

  if (!data) return null;

  const { position, borrowedAssets, health, usdcBalance, borrowApyPercent } =
    data;

  const canWithdraw =
    position.borrowShares === BigInt(0) && position.collateral > BigInt(0);

  const repayAllSufficient = usdcBalance >= borrowedAssets;

  const debtUsd = Number(borrowedAssets) / 10 ** USDC_DECIMALS;
  const dailyInterest = debtUsd * (borrowApyPercent / 100) / 365;

  const usdcMaxStr = (Number(usdcBalance) / 10 ** USDC_DECIMALS).toFixed(6);

  const handleRepay = async () => {
    if (!repayInput.trim()) return;
    const amount = BigInt(
      Math.round(parseFloat(repayInput) * 10 ** USDC_DECIMALS),
    );
    if (amount <= BigInt(0)) return;
    const hash = await repay(amount);
    if (hash) {
      setRepayMode(false);
      setRepayInput("");
      onRefresh();
    }
  };

  const handleRepayAll = async () => {
    if (!repayAllSufficient) return;
    const hash = await repay(BigInt(0), {
      fullRepayShares: position.borrowShares,
    });
    if (hash) {
      setRepayMode(false);
      if (activeLoan) {
        await settleLoan(activeLoan.id, hash);
        onLoanSettled?.();
      }
      onRefresh();
    }
  };

  const handleWithdraw = async () => {
    const hash = await withdraw(position.collateral);
    if (hash) onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Warning banners */}
      {health.zone === "warning" && (
        <div className="rounded-lg bg-yellow-50 p-3 text-xs font-medium text-yellow-800">
          {t("credit.warningBanner")}
        </div>
      )}
      {health.zone === "danger" && (
        <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-800">
          {t("credit.dangerBanner")}
        </div>
      )}

      {/* Position overview card */}
      <Card className="relative overflow-hidden">
        <div className="absolute right-3 top-3 text-2xl font-semibold opacity-10">
          ₿
        </div>
        <h2 className="text-sm font-semibold text-arka-text">
          {t("credit.activeTitle")}
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-arka-text-muted">
              {t("credit.lockedBtc")}
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-arka-text">
              {formatCbBtc(position.collateral, localeStr)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-arka-text-muted">
              {t("credit.totalDebt")}
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-arka-text">
              ${formatUsdc(borrowedAssets, localeStr)}
            </p>
            {borrowApyPercent > 0 && (
              <p className="mt-0.5 text-[10px] text-arka-text-muted">
                {borrowApyPercent.toFixed(2)}% APY · ~$
                {dailyInterest < 0.01
                  ? dailyInterest.toFixed(6)
                  : dailyInterest.toFixed(2)}
                /day
              </p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <SafetyMeter
            score={health.safetyScore}
            zone={health.zone}
            label={t("credit.healthLabel")}
          />
        </div>
      </Card>

      {/* Repay section */}
      {borrowedAssets > BigInt(0) && (
        <Card>
          {repayMode ? (
            <div className="space-y-3">
              <label className="text-xs font-medium text-arka-text-muted">
                {t("credit.repayAmountLabel")}
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={repayInput}
                  onChange={(e) => setRepayInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-arka-border bg-arka-surface px-3 py-2.5 pr-16 font-mono text-sm text-arka-text outline-none focus:border-arka-accent"
                />
                <button
                  type="button"
                  onClick={() => setRepayInput(usdcMaxStr)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-arka-accent/10 px-2.5 py-1 text-[11px] font-semibold text-arka-accent hover:bg-arka-accent/20"
                >
                  {t("credit.maxBtn")}
                </button>
              </div>
              <p className="text-xs text-arka-text-muted">
                {t("credit.usdcBalance")}: ${formatUsdc(usdcBalance, localeStr)}
              </p>

              {repayError && (
                <p className="text-xs text-red-600">{repayError}</p>
              )}
              {repayTx && (
                <a
                  href={`https://basescan.org/tx/${repayTx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-arka-accent hover:underline"
                >
                  {t("credit.repaySuccess")} →
                </a>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={handleRepay} disabled={repayBusy}>
                  {repayBusy ? t("credit.repaying") : t("credit.repayBtn")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleRepayAll}
                  disabled={repayBusy || !repayAllSufficient}
                >
                  {t("credit.repayAll")}
                </Button>
              </div>
              {!repayAllSufficient && (
                <p className="text-[11px] text-amber-600">
                  {t("credit.repayAllInsufficient")}
                </p>
              )}
              <button
                type="button"
                onClick={() => setRepayMode(false)}
                className="text-xs text-arka-text-muted hover:text-arka-text"
              >
                ← Kembali
              </button>
            </div>
          ) : (
            <Button onClick={() => setRepayMode(true)}>
              {t("credit.repayBtn")}
            </Button>
          )}
        </Card>
      )}

      {/* Withdraw collateral (only when fully repaid) */}
      {canWithdraw && (
        <Card>
          {withdrawTx ? (
            <a
              href={`https://basescan.org/tx/${withdrawTx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-arka-accent hover:underline"
            >
              {t("credit.withdrawSuccess")} →
            </a>
          ) : (
            <>
              {withdrawError && (
                <p className="mb-2 text-xs text-red-600">{withdrawError}</p>
              )}
              <Button onClick={handleWithdraw} disabled={withdrawBusy}>
                {withdrawBusy
                  ? t("credit.withdrawing")
                  : t("credit.withdrawBtn")}
              </Button>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fulfilled loan card
// ---------------------------------------------------------------------------

function FulfilledLoanCard({
  loan,
  onOpenNew,
}: {
  loan: CreditLoanRecord;
  onOpenNew: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const localeStr = locale === "id" ? "id-ID" : "en-US";

  const collateral = Number(loan.collateralRaw) / 1e8;
  const borrow = Number(loan.borrowRaw) / 10 ** USDC_DECIMALS;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(localeStr, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute right-3 top-3 text-2xl font-semibold text-green-200">
        ✓
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-lg text-green-700">
          ✓
        </div>
        <div>
          <h2 className="text-sm font-semibold text-arka-text">
            {t("credit.loanFulfilled")}
          </h2>
          <p className="text-[11px] text-arka-text-muted">
            {t("credit.settledOn")} {fmtDate(loan.settledAt!)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-arka-text-muted">
            {t("credit.lockedBtc")}
          </p>
          <p className="mt-0.5 font-mono font-semibold text-arka-text">
            {collateral.toFixed(8)} BTC
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-arka-text-muted">
            {t("credit.outstanding")}
          </p>
          <p className="mt-0.5 font-mono font-semibold text-arka-text">
            ${borrow.toFixed(6)} USDC
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <TxLink label={t("credit.lockBtcTx")} hash={loan.lockTxHash} />
        <TxLink label={t("credit.borrowTx")} hash={loan.borrowTxHash} />
        {loan.settleTxHash && (
          <TxLink label={t("credit.settleTx")} hash={loan.settleTxHash} />
        )}
      </div>

      <p className="mt-3 text-[10px] text-arka-text-muted">
        {t("credit.openedOn")} {fmtDate(loan.openedAt)}
      </p>

      <Button className="mt-4" onClick={onOpenNew}>
        {t("credit.openNewCredit")}
      </Button>
    </Card>
  );
}

function TxLink({ label, hash }: { label: string; hash: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-arka-text-muted">{label}</span>
      <a
        href={`https://basescan.org/tx/${hash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-medium text-arka-accent hover:underline"
      >
        {hash.slice(0, 8)}…{hash.slice(-6)} →
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main credit client
// ---------------------------------------------------------------------------

export function CreditClient() {
  const { ready, authenticated } = usePrivy();
  const t = useT();
  const { data, loading, error, refetch, address } = useCreditPosition();
  const {
    loans,
    loading: loansLoading,
    refetch: refetchLoans,
  } = useCreditLoans();
  const [showOpenFlow, setShowOpenFlow] = useState(false);

  const activeLoan = loans.find((l) => l.status === "active") ?? null;
  const latestFulfilled = loans.find((l) => l.status === "fulfilled") ?? null;

  const handleOpenSuccess = useCallback(
    (_data: OpenSuccessData) => {
      setShowOpenFlow(false);
      refetch();
      refetchLoans();
    },
    [refetch, refetchLoans],
  );

  const handleLoanSettled = useCallback(() => {
    refetchLoans();
  }, [refetchLoans]);

  if (!ready || !authenticated) return null;

  const hasPosition =
    data &&
    (data.position.collateral > BigInt(0) ||
      data.position.borrowShares > BigInt(0));
  const hasBtc = data && data.cbBtcBalance > BigInt(0);

  const showFulfilledCard =
    data && !hasPosition && !showOpenFlow && latestFulfilled;

  return (
    <Screen title={t("credit.title")} subtitle={t("credit.subtitle")}>
      {(loading || loansLoading) && !data && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-[var(--radius-card)] bg-arka-border/60"
            />
          ))}
        </div>
      )}

      {error && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* State 1: Active position */}
      {data && hasPosition && (
        <ActivePosition
          onRefresh={refetch}
          activeLoan={activeLoan}
          onLoanSettled={handleLoanSettled}
        />
      )}

      {/* State 2: Fulfilled loan — no active on-chain position */}
      {showFulfilledCard && (
        <FulfilledLoanCard
          loan={latestFulfilled}
          onOpenNew={() => setShowOpenFlow(true)}
        />
      )}

      {/* State 3: Open flow (no position, has BTC, no recent fulfilled or user clicked "Open New") */}
      {data &&
        !hasPosition &&
        hasBtc &&
        !showFulfilledCard &&
        address && (
          <OpenCreditFlow
            cbBtcBalance={data.cbBtcBalance}
            oraclePrice={data.oraclePrice}
            walletAddress={address}
            onSuccess={handleOpenSuccess}
          />
        )}

      {/* Explicit open flow after clicking "Open New Credit" on fulfilled card */}
      {data && !hasPosition && showOpenFlow && address && (
        <OpenCreditFlow
          cbBtcBalance={data.cbBtcBalance}
          oraclePrice={data.oraclePrice}
          walletAddress={address}
          onSuccess={handleOpenSuccess}
        />
      )}

      {/* State 4: No BTC at all, no fulfilled loan */}
      {data && !hasPosition && !hasBtc && !showFulfilledCard && (
        <Card className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
            ₿
          </div>
          <p className="text-sm text-arka-text-muted">{t("credit.noBtc")}</p>
          <Link href="/dca" className="mt-3 inline-block">
            <Button variant="primary" className="w-auto min-w-[10rem]">
              {t("credit.noBtcBtn")}
            </Button>
          </Link>
        </Card>
      )}

      <CreditEducation />
    </Screen>
  );
}
