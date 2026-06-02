"use client";

import { useBalances } from "@/hooks/use-balances";
import { USDC_DECIMALS } from "@/lib/contracts/morpho-credit";
import { useT } from "@/lib/i18n";
import Link from "next/link";
import { parseUnits } from "viem";
import { WithdrawPanel } from "./withdraw-panel";

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

export function WithdrawClient() {
  const t = useT();
  const balances = useBalances();

  const usdcBalanceRaw = balances.usdc
    ? parseUnits(balances.usdc.toFixed(USDC_DECIMALS), USDC_DECIMALS)
    : BigInt(0);

  return (
    <div className="px-5 pb-14">
      <BackHeader title={t("withdraw.title")} />

      <div className="mt-5 space-y-4">
        <WithdrawPanel source="USDC" usdcBalance={usdcBalanceRaw} />

        <button
          type="button"
          className="w-full rounded-[14px] border px-4 py-3 text-left text-[12px]"
          style={{
            borderColor: "var(--paysats-danger)",
            color: "var(--paysats-danger)",
            background: "rgba(196,48,48,0.04)",
          }}
          onClick={() =>
            window.open(
              "mailto:support@paysats.exchange?subject=Sell%20Bitcoin",
              "_blank",
            )
          }
          data-pressable
        >
          {t("withdraw.sellBtc")}
        </button>
      </div>
    </div>
  );
}
