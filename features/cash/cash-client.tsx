"use client";

import { Card } from "@/components/ui/card";
import { useBalances } from "@/hooks/use-balances";
import { useCreditPosition } from "@/hooks/use-credit-line";
import { useCurrency } from "@/lib/currency";
import { USDC_DECIMALS } from "@/lib/contracts/morpho-credit";
import { useT } from "@/lib/i18n";
import Link from "next/link";
import { useMemo } from "react";

const IDR_FALLBACK_PER_USD = 16_500;

function BackHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-12">
      <Link
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
      </Link>
      <div
        className="text-lg font-extrabold"
        style={{ color: "var(--paysats-text)", letterSpacing: -0.4 }}
      >
        {title}
      </div>
    </div>
  );
}

function BalanceRow({
  icon,
  label,
  sublabel,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  right: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]"
        style={{
          background: "var(--paysats-accent-soft)",
          color: "var(--paysats-accent)",
          fontWeight: 800,
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[13px] font-bold"
          style={{ color: "var(--paysats-text)" }}
        >
          {label}
        </div>
        {sublabel ? (
          <div
            className="mt-0.5 text-[11px]"
            style={{ color: "var(--paysats-text-faint)" }}
          >
            {sublabel}
          </div>
        ) : null}
      </div>
      <div className="text-right">{right}</div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ background: color }}
    />
  );
}

export function CashClient() {
  const t = useT();
  const { currency } = useCurrency();
  const balances = useBalances();
  const credit = useCreditPosition();

  const idrx = balances.idrx ?? 0;
  const usdc = balances.usdc ?? 0;

  const borrowedUsd = credit.data
    ? Number(credit.data.borrowedAssets) / 10 ** USDC_DECIMALS
    : 0;

  // USDC split: what came from deposits (cash) vs drawn from the credit line.
  // If debt > current USDC balance (user already spent some of the borrow),
  // credit portion is capped at the remaining balance.
  const creditUsdc = Math.max(0, Math.min(borrowedUsd, usdc));
  const cashUsdc = Math.max(0, usdc - creditUsdc);

  const { primaryTotal, secondaryTotal } = useMemo(() => {
    const totalIdr = idrx + usdc * IDR_FALLBACK_PER_USD;
    const totalUsd = usdc + idrx / IDR_FALLBACK_PER_USD;
    const idrStr = `≈ Rp ${totalIdr.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
    const usdStr = `≈ $${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    return currency === "USD"
      ? { primaryTotal: usdStr, secondaryTotal: idrStr }
      : { primaryTotal: idrStr, secondaryTotal: usdStr };
  }, [idrx, usdc, currency]);

  const cashColor = "var(--paysats-success, #17a34a)";
  const creditColor = "var(--paysats-accent)";

  return (
    <div className="px-5 pb-14">
      <BackHeader title={t("cash.title")} />

      <div className="mt-5">
        <Card>
          <div
            className="text-[11px] font-bold uppercase tracking-[0.1em]"
            style={{ color: "var(--paysats-text-faint)" }}
          >
            {t("cash.total")}
          </div>
          <div
            className="mt-2 text-[30px] font-extrabold leading-none"
            style={{ color: "var(--paysats-text)", letterSpacing: -0.6 }}
          >
            {primaryTotal}
          </div>
          <div
            className="mt-1.5 text-[12px]"
            style={{ color: "var(--paysats-text-faint)" }}
          >
            {secondaryTotal}
          </div>
        </Card>
      </div>

      <div className="mt-4 space-y-3">
        <Card className="py-0">
          <BalanceRow
            icon={
              <span
                className="flex h-10 w-10 items-center justify-center rounded-[12px] text-[13px] font-extrabold"
                style={{
                  background: "rgba(23,163,74,0.12)",
                  color: "#17a34a",
                }}
              >
                Rp
              </span>
            }
            label={t("cash.idrx")}
            sublabel={t("cash.idrxDesc")}
            right={
              <div
                className="text-[14px] font-extrabold"
                style={{ color: "var(--paysats-text)" }}
              >
                Rp {idrx.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
              </div>
            }
          />
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-[12px] text-[14px] font-extrabold"
              style={{
                background: "rgba(37,99,235,0.12)",
                color: "#2563eb",
              }}
            >
              $
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-[13px] font-bold"
                style={{ color: "var(--paysats-text)" }}
              >
                {t("cash.usdc")}
              </div>
              <div
                className="mt-0.5 text-[11px]"
                style={{ color: "var(--paysats-text-faint)" }}
              >
                Base
              </div>
            </div>
            <div
              className="text-[14px] font-extrabold"
              style={{ color: "var(--paysats-text)" }}
            >
              ${usdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>

          <div
            className="mt-3 border-t pt-2"
            style={{ borderColor: "var(--paysats-border)" }}
          >
            <div className="flex items-center justify-between py-1.5 text-[12px]">
              <span
                className="flex items-center gap-2"
                style={{ color: "var(--paysats-text-muted)" }}
              >
                <Dot color={cashColor} />
                {t("cash.cashBalance")}
              </span>
              <span
                className="font-extrabold tabular-nums"
                style={{ color: "var(--paysats-text)" }}
              >
                ${cashUsdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 text-[12px]">
              <span
                className="flex items-center gap-2"
                style={{ color: "var(--paysats-text-muted)" }}
              >
                <Dot color={creditColor} />
                {t("cash.creditBalance")}
              </span>
              <span
                className="font-extrabold tabular-nums"
                style={{ color: "var(--paysats-text)" }}
              >
                ${creditUsdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
