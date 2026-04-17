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
  formatUsdc,
  formatCbBtc,
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

function OpenCreditFlow({
  cbBtcBalance,
  oraclePrice,
  onSuccess,
}: {
  cbBtcBalance: bigint;
  oraclePrice: bigint;
  onSuccess: () => void;
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

  const { open, busy, error, txHash } = useOpenCreditLine();

  const handleOpen = useCallback(async () => {
    if (borrowAmount <= BigInt(0) || collateralAmount <= BigInt(0)) return;
    const hash = await open({ collateralAmount, borrowAmount });
    if (hash) onSuccess();
  }, [open, collateralAmount, borrowAmount, onSuccess]);

  if (txHash) {
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
          href={`https://basescan.org/tx/${txHash}`}
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

function ActivePosition({ onRefresh }: { onRefresh: () => void }) {
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

  if (!data) return null;

  const { position, borrowedAssets, health, oraclePrice, usdcBalance } = data;

  const canWithdraw =
    position.borrowShares === BigInt(0) && position.collateral > BigInt(0);

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
    const hash = await repay(BigInt(0), {
      fullRepayShares: position.borrowShares,
    });
    if (hash) {
      setRepayMode(false);
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
              {t("credit.outstanding")}
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-arka-text">
              ${formatUsdc(borrowedAssets, localeStr)}
            </p>
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
              <input
                type="number"
                inputMode="decimal"
                value={repayInput}
                onChange={(e) => setRepayInput(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-arka-border bg-arka-surface px-3 py-2.5 font-mono text-sm text-arka-text outline-none focus:border-arka-accent"
              />
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

              <div className="flex gap-2">
                <Button onClick={handleRepay} disabled={repayBusy}>
                  {repayBusy ? t("credit.repaying") : t("credit.repayBtn")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleRepayAll}
                  disabled={repayBusy}
                  className="w-auto min-w-[8rem] shrink-0"
                >
                  {t("credit.repayAll")}
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={() => setRepayMode(false)}
                className="text-xs"
              >
                ← Kembali
              </Button>
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
// Main credit client
// ---------------------------------------------------------------------------

export function CreditClient() {
  const { ready, authenticated } = usePrivy();
  const t = useT();
  const { data, loading, error, refetch } = useCreditPosition();

  if (!ready || !authenticated) return null;

  const hasPosition =
    data &&
    (data.position.collateral > BigInt(0) || data.position.borrowShares > BigInt(0));
  const hasBtc = data && data.cbBtcBalance > BigInt(0);

  return (
    <Screen title={t("credit.title")} subtitle={t("credit.subtitle")}>
      {loading && !data && (
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
      {data && hasPosition && <ActivePosition onRefresh={refetch} />}

      {/* State 2: No position but has BTC — show open flow */}
      {data && !hasPosition && hasBtc && (
        <OpenCreditFlow
          cbBtcBalance={data.cbBtcBalance}
          oraclePrice={data.oraclePrice}
          onSuccess={refetch}
        />
      )}

      {/* State 3: No BTC at all */}
      {data && !hasPosition && !hasBtc && (
        <Card className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
            ₿
          </div>
          <p className="text-sm text-arka-text-muted">
            {t("credit.noBtc")}
          </p>
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
