"use client";

import { Card } from "@/components/ui/card";
import { GradButton } from "@/components/ui/grad-button";
import { InlinePanel } from "@/components/ui/inline-panel";
import { Input, Label } from "@/components/ui/input";
import { useCurrency } from "@/lib/currency";
import { useT } from "@/lib/i18n";
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
  useBorrowAgainstCollateral,
  useRepayCreditLine,
  useWithdrawCollateral,
  formatUsdc,
  formatCbBtc,
} from "@/hooks/use-credit-line";
import { CreditEducation } from "./credit-education";
import { useCallback, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";

const IDR_FALLBACK_PER_USD = 16_500;

function shortFiat(v: number, currency: "IDR" | "USD") {
  if (!Number.isFinite(v)) return "—";
  if (currency === "USD")
    return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `Rp ${v.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

const ZONE: Record<
  SafetyZone,
  { color: string; background: string; label: "safe" | "warning" | "danger" }
> = {
  safe: {
    color: "var(--paysats-success)",
    background: "var(--paysats-success-soft)",
    label: "safe",
  },
  warning: {
    color: "var(--paysats-warning)",
    background: "var(--paysats-warning-soft)",
    label: "warning",
  },
  danger: {
    color: "var(--paysats-danger)",
    background: "rgba(196,48,48,0.08)",
    label: "danger",
  },
};

function Hero({
  title,
  primary,
  secondary,
}: {
  title: string;
  primary: string;
  secondary?: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[22px] p-6 text-white"
      style={{
        background: "var(--paysats-gradient-hero)",
        backgroundSize: "300% 300%",
        animation: "grad-move 14s ease infinite",
        boxShadow: "var(--paysats-shadow-hero)",
      }}
    >
      <div
        className="text-[11px] font-bold uppercase tracking-[0.1em]"
        style={{ color: "rgba(255,255,255,0.75)" }}
      >
        {title}
      </div>
      <div
        className="mt-2.5 text-[34px] font-extrabold leading-none"
        style={{ letterSpacing: -0.8 }}
      >
        {primary}
      </div>
      {secondary ? (
        <div
          className="mt-2 text-[12px]"
          style={{ color: "rgba(255,255,255,0.85)" }}
        >
          {secondary}
        </div>
      ) : null}
    </div>
  );
}

function StatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "text" | "accent" | "success" | "warning" | "danger";
}) {
  const color =
    tone === "accent"
      ? "var(--paysats-accent)"
      : tone === "success"
        ? "var(--paysats-success)"
        : tone === "warning"
          ? "var(--paysats-warning)"
          : tone === "danger"
            ? "var(--paysats-danger)"
            : "var(--paysats-text)";
  return (
    <div className="flex items-center justify-between py-2">
      <span
        className="text-[12px]"
        style={{ color: "var(--paysats-text-muted)" }}
      >
        {label}
      </span>
      <span
        className="text-[13px] font-extrabold tabular-nums"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}

function HealthBar({
  score,
  zone,
  label,
}: {
  score: number;
  zone: SafetyZone;
  label: string;
}) {
  const z = ZONE[zone];
  return (
    <div className="pt-1">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span style={{ color: "var(--paysats-text-muted)" }}>{label}</span>
        <span
          className="rounded-[6px] px-1.5 py-0.5 text-[10px] font-extrabold uppercase"
          style={{ color: z.color, background: z.background }}
        >
          {z.label}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ background: "var(--paysats-border)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.max(6, Math.min(100, score))}%`,
            background: z.color,
          }}
        />
      </div>
    </div>
  );
}

// ---------- BorrowSetup ----------

function BorrowSetup() {
  const t = useT();
  const { currency } = useCurrency();
  const { data } = useCreditPosition();
  const { open, busy, error } = useOpenCreditLine();

  const [pct, setPct] = useState(50);

  const cbBtc = data?.cbBtcBalance ?? BigInt(0);
  const collateralAmount = (cbBtc * BigInt(Math.floor(pct))) / BigInt(100);
  const maxBorrow = data
    ? maxSafeBorrow(collateralAmount, data.oraclePrice)
    : BigInt(0);

  const borrowUsd = Number(formatUnits(maxBorrow, USDC_DECIMALS));
  const fiat = currency === "USD" ? borrowUsd : borrowUsd * IDR_FALLBACK_PER_USD;

  const handleOpen = useCallback(async () => {
    if (collateralAmount <= BigInt(0) || maxBorrow <= BigInt(0)) return;
    try {
      await open({ collateralAmount, borrowAmount: maxBorrow });
    } catch {
      /* surfaced via error state */
    }
  }, [open, collateralAmount, maxBorrow]);

  if (!data) {
    return (
      <Card>
        <div className="h-20 animate-pulse rounded bg-paysats-border/40" />
      </Card>
    );
  }

  if (cbBtc === BigInt(0)) {
    return (
      <Card className="text-center">
        <p
          className="text-sm"
          style={{ color: "var(--paysats-text-muted)" }}
        >
          {t("credit.noBtc")}
        </p>
        <div className="mt-3">
          <a
            href="/save"
            className="inline-block rounded-[10px] px-3 py-2 text-[12px] font-extrabold"
            style={{
              color: "var(--paysats-accent)",
              background: "var(--paysats-accent-soft)",
            }}
          >
            {t("credit.noBtcBtn")}
          </a>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Hero
        title={t("credit.openTitle")}
        primary={shortFiat(fiat, currency)}
        secondary={`≈ ${formatCbBtc(collateralAmount)} BTC ${t(
          "credit.lockLabel",
        )}`}
      />

      <Card>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span
              className="text-[12px]"
              style={{ color: "var(--paysats-text-muted)" }}
            >
              {t("credit.lockLabel")}
            </span>
            <span className="text-[13px] font-extrabold tabular-nums">
              {pct}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="w-full accent-[var(--paysats-accent)]"
          />
          <StatRow
            label={t("credit.maxBorrow")}
            value={`${formatUsdc(maxBorrow)} USDC`}
            tone="accent"
          />
          <StatRow
            label={t("credit.interestRate")}
            value={`~ ${(Number(MAX_BORROW_LTV_RATIO) * 0 + 6).toFixed(2)}% APR`}
          />
        </div>
      </Card>

      {error ? (
        <p className="text-xs" style={{ color: "var(--paysats-danger)" }}>
          {error}
        </p>
      ) : null}

      <GradButton onClick={handleOpen} disabled={busy || maxBorrow === BigInt(0)}>
        {busy ? t("credit.confirmingBtn") : t("credit.confirmBtn")}
      </GradButton>

      <CreditEducation />
    </div>
  );
}

// ---------- BorrowActive ----------

type ActivePanel = "borrow" | "repay" | null;

function BorrowActive() {
  const t = useT();
  const { currency } = useCurrency();
  const { data, refetch } = useCreditPosition();
  const borrowMore = useBorrowAgainstCollateral();
  const repay = useRepayCreditLine();
  const withdrawCollat = useWithdrawCollateral();

  const [panel, setPanel] = useState<ActivePanel>(null);
  const togglePanel = (p: ActivePanel) =>
    setPanel((cur) => (cur === p ? null : p));

  const [borrowAmt, setBorrowAmt] = useState("");
  const [repayAmt, setRepayAmt] = useState("");

  // Max additional borrow available against the currently-locked collateral,
  // after subtracting outstanding debt.
  const maxAdditionalBorrow = useMemo(() => {
    if (!data) return BigInt(0);
    const cap = maxSafeBorrow(data.position.collateral, data.oraclePrice);
    if (cap <= data.borrowedAssets) return BigInt(0);
    return cap - data.borrowedAssets;
  }, [data]);

  const doBorrowMore = useCallback(async () => {
    const n = Number(borrowAmt);
    if (!Number.isFinite(n) || n <= 0) return;
    try {
      await borrowMore.borrow(parseUnits(n.toFixed(USDC_DECIMALS), USDC_DECIMALS));
      setBorrowAmt("");
      await refetch();
    } catch {
      /* error surfaced by hook */
    }
  }, [borrowAmt, borrowMore, refetch]);

  const doRepay = useCallback(async () => {
    const n = Number(repayAmt);
    if (!Number.isFinite(n) || n <= 0) return;
    try {
      await repay.repay(parseUnits(n.toFixed(USDC_DECIMALS), USDC_DECIMALS));
      setRepayAmt("");
      await refetch();
    } catch {
      /* error surfaced by hook */
    }
  }, [repayAmt, repay, refetch]);

  const doRepayAll = useCallback(async () => {
    if (!data) return;
    const shares = data.position.borrowShares;
    if (shares <= BigInt(0)) return;
    // Guard: require USDC balance ≥ outstanding debt (with tiny buffer for rounding).
    if (data.usdcBalance < data.borrowedAssets) {
      return;
    }
    try {
      await repay.repay(BigInt(0), { fullRepayShares: shares });
      setRepayAmt("");
      await refetch();
    } catch {
      /* error surfaced by hook */
    }
  }, [data, repay, refetch]);

  const doWithdrawAllCollateral = useCallback(async () => {
    if (!data) return;
    const amount = data.position.collateral;
    if (amount <= BigInt(0)) return;
    try {
      await withdrawCollat.withdraw(amount);
      await refetch();
    } catch {
      /* error surfaced by hook */
    }
  }, [data, withdrawCollat, refetch]);

  if (!data) {
    return (
      <Card>
        <div className="h-28 animate-pulse rounded bg-paysats-border/40" />
      </Card>
    );
  }

  const outstandingUsd = Number(
    formatUnits(data.borrowedAssets, USDC_DECIMALS),
  );
  const outstandingFiat =
    currency === "USD" ? outstandingUsd : outstandingUsd * IDR_FALLBACK_PER_USD;

  const collatBtc = Number(
    formatUnits(data.position.collateral, CBBTC_DECIMALS),
  );

  const health = deriveCreditHealth(
    data.position.collateral,
    data.oraclePrice,
    data.borrowedAssets,
  );

  const isFullyRepaid =
    data.borrowedAssets === BigInt(0) &&
    data.position.borrowShares === BigInt(0) &&
    data.position.collateral > BigInt(0);

  const usdcBal = data.usdcBalance;
  const canRepayAll =
    data.borrowedAssets > BigInt(0) && usdcBal >= data.borrowedAssets;

  // ----- Fully repaid state: only withdraw-collateral is available -----
  if (isFullyRepaid) {
    return (
      <div className="space-y-4">
        <Hero
          title={t("credit.repaidTitle")}
          primary={`${collatBtc.toFixed(6)} BTC`}
          secondary={t("credit.repaidDesc")}
        />

        <Card>
          <StatRow
            label={t("credit.outstanding")}
            value={`0.00 USDC`}
            tone="success"
          />
          <StatRow
            label={t("credit.lockedBtc")}
            value={`${collatBtc.toFixed(6)} BTC`}
          />
        </Card>

        {withdrawCollat.error ? (
          <p className="text-xs" style={{ color: "var(--paysats-danger)" }}>
            {withdrawCollat.error}
          </p>
        ) : null}

        <GradButton
          onClick={doWithdrawAllCollateral}
          disabled={withdrawCollat.busy}
        >
          {withdrawCollat.busy
            ? t("credit.withdrawing")
            : t("credit.withdrawAllCollatBtn")}
        </GradButton>

        <CreditEducation />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Hero
        title={t("credit.activeTitle")}
        primary={shortFiat(outstandingFiat, currency)}
        secondary={`${formatUsdc(data.borrowedAssets)} USDC · ${collatBtc.toFixed(
          6,
        )} BTC ${t("credit.lockedBtc").toLowerCase()}`}
      />

      <Card>
        <StatRow
          label={t("credit.outstanding")}
          value={`${formatUsdc(data.borrowedAssets)} USDC`}
        />
        <StatRow
          label={t("credit.lockedBtc")}
          value={`${collatBtc.toFixed(6)} BTC`}
        />
        <HealthBar
          score={health.safetyScore}
          zone={health.zone}
          label={t("credit.healthLabel")}
        />
      </Card>

      <div className="grid grid-cols-2 gap-2">
        {[
          { key: "borrow" as const, label: t("credit.borrowMoreBtn") },
          { key: "repay" as const, label: t("credit.repayBtn") },
        ].map((b) => {
          const active = panel === b.key;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => togglePanel(b.key)}
              className="rounded-[14px] px-3 py-3 text-[12px] font-extrabold transition"
              style={{
                background: active
                  ? "var(--paysats-accent)"
                  : "var(--paysats-surface)",
                color: active ? "#fff" : "var(--paysats-text)",
                boxShadow: "var(--paysats-shadow-card)",
              }}
              data-pressable
            >
              {b.label}
            </button>
          );
        })}
      </div>

      <InlinePanel open={panel === "borrow"}>
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="w-amt">{t("credit.borrowLabel")}</Label>
            <button
              type="button"
              onClick={() =>
                setBorrowAmt(
                  formatUnits(maxAdditionalBorrow, USDC_DECIMALS),
                )
              }
              className="rounded-[8px] px-2 py-1 text-[11px] font-extrabold"
              style={{
                color: "var(--paysats-accent)",
                background: "var(--paysats-accent-soft)",
              }}
              data-pressable
              disabled={maxAdditionalBorrow === BigInt(0)}
            >
              {t("credit.maxBtn")}
            </button>
          </div>
          <Input
            id="w-amt"
            inputMode="decimal"
            value={borrowAmt}
            onChange={(e) => setBorrowAmt(e.target.value)}
            placeholder="0.00"
          />
          <div
            className="text-[11px]"
            style={{ color: "var(--paysats-text-muted)" }}
          >
            {t("credit.maxAvailable")}:{" "}
            <span
              className="font-extrabold tabular-nums"
              style={{ color: "var(--paysats-accent)" }}
            >
              {formatUsdc(maxAdditionalBorrow)} USDC
            </span>
          </div>
          {borrowMore.error ? (
            <p className="text-xs" style={{ color: "var(--paysats-danger)" }}>
              {borrowMore.error}
            </p>
          ) : null}
          <GradButton
            onClick={doBorrowMore}
            disabled={borrowMore.busy || maxAdditionalBorrow === BigInt(0)}
          >
            {borrowMore.busy
              ? t("credit.confirmingBtn")
              : t("credit.finishBorrowBtn")}
          </GradButton>
        </Card>
      </InlinePanel>

      <InlinePanel open={panel === "repay"}>
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="r-amt">{t("credit.repayAmountLabel")}</Label>
            <div
              className="text-[11px]"
              style={{ color: "var(--paysats-text-muted)" }}
            >
              {t("credit.usdcBalance")}:{" "}
              <span className="font-extrabold tabular-nums">
                {formatUsdc(usdcBal)}
              </span>
            </div>
          </div>
          <Input
            id="r-amt"
            inputMode="decimal"
            value={repayAmt}
            onChange={(e) => setRepayAmt(e.target.value)}
            placeholder="0.00"
          />
          {repay.error ? (
            <p className="text-xs" style={{ color: "var(--paysats-danger)" }}>
              {repay.error}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <GradButton onClick={doRepay} disabled={repay.busy}>
              {repay.busy ? t("credit.repaying") : t("credit.repayBtn")}
            </GradButton>
            <button
              type="button"
              onClick={doRepayAll}
              disabled={repay.busy || !canRepayAll}
              className="rounded-[14px] px-3 py-3 text-[13px] font-extrabold transition disabled:opacity-50"
              style={{
                background: "var(--paysats-surface)",
                color: "var(--paysats-accent)",
                boxShadow: "var(--paysats-shadow-card)",
                border: "1px solid var(--paysats-accent-soft)",
              }}
              data-pressable
            >
              {repay.busy ? t("credit.repaying") : t("credit.repayAll")}
            </button>
          </div>
          {!canRepayAll && data.borrowedAssets > BigInt(0) ? (
            <p
              className="text-[11px]"
              style={{ color: "var(--paysats-text-muted)" }}
            >
              {t("credit.repayAllInsufficient")}
            </p>
          ) : null}
        </Card>
      </InlinePanel>

      {health.zone === "warning" ? (
        <div
          className="rounded-[12px] p-3 text-[12px]"
          style={{
            background: "var(--paysats-warning-soft)",
            color: "var(--paysats-warning)",
          }}
        >
          {t("credit.warningBanner")}
        </div>
      ) : null}
      {health.zone === "danger" ? (
        <div
          className="rounded-[12px] p-3 text-[12px]"
          style={{
            background: "rgba(196,48,48,0.08)",
            color: "var(--paysats-danger)",
          }}
        >
          {t("credit.dangerBanner")}
        </div>
      ) : null}

      <CreditEducation />
    </div>
  );
}

// ---------- Root ----------

function BackHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-12">
      <a
        href="/home"
        aria-label="Back"
        className="flex h-10 w-10 items-center justify-center rounded-[12px]"
        data-pressable
        style={{
          background: "var(--paysats-surface)",
          boxShadow: "var(--paysats-shadow-card)",
          color: "var(--paysats-text)",
        }}
      >
        ←
      </a>
      <div
        className="text-lg font-extrabold"
        style={{ color: "var(--paysats-text)", letterSpacing: -0.4 }}
      >
        {title}
      </div>
    </div>
  );
}

export function CreditClient() {
  const t = useT();
  const { data, loading } = useCreditPosition();

  const hasPosition = useMemo(() => {
    if (!data) return false;
    return (
      data.position.collateral > BigInt(0) ||
      data.position.borrowShares > BigInt(0)
    );
  }, [data]);

  return (
    <div className="px-5 pb-14">
      <BackHeader title={t("credit.title")} />
      <div className="mt-5">
        {loading && !data ? (
          <Card>
            <div className="h-28 animate-pulse rounded bg-paysats-border/40" />
          </Card>
        ) : hasPosition ? (
          <BorrowActive />
        ) : (
          <BorrowSetup />
        )}
      </div>
    </div>
  );
}
