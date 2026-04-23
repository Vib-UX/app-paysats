"use client";

import { Card } from "@/components/ui/card";
import { GradButton } from "@/components/ui/grad-button";
import { Input, Label } from "@/components/ui/input";
import { PillSeg } from "@/components/ui/pill-seg";
import { OfframpClient } from "@/features/offramp/offramp-client";
import { useT } from "@/lib/i18n";
import { erc20Abi } from "@/lib/contracts/arka-dca";
import {
  USDC_ADDRESS,
  USDC_DECIMALS,
} from "@/lib/contracts/morpho-credit";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useCallback, useMemo, useState } from "react";
import {
  encodeFunctionData,
  getAddress,
  isAddress,
  parseUnits,
} from "viem";

type DestinationKey = "bank" | "external";

export function WithdrawPanel({
  source,
  usdcBalance,
}: {
  source: "IDRX" | "USDC";
  /** Raw USDC balance (6 decimals) for external transfers. */
  usdcBalance: bigint;
}) {
  const t = useT();
  const [dest, setDest] = useState<DestinationKey>(
    source === "USDC" ? "bank" : "external",
  );

  const destOptions = useMemo(() => {
    if (source === "USDC") {
      return [
        { value: "bank" as const, label: t("withdraw.dest.bank") },
        { value: "external" as const, label: t("withdraw.dest.external") },
      ];
    }
    return [
      { value: "external" as const, label: t("withdraw.dest.external") },
    ];
  }, [source, t]);

  return (
    <Card>
      <div className="space-y-3">
        <div>
          <Label>{t("withdraw.destination")}</Label>
          <PillSeg
            options={destOptions}
            value={dest}
            onChange={(v) => setDest(v as DestinationKey)}
          />
        </div>

        {dest === "bank" && source === "USDC" ? (
          <div className="pt-1">
            <OfframpClient usdcBalance={usdcBalance} />
          </div>
        ) : null}

        {dest === "external" ? (
          <ExternalWalletForm source={source} />
        ) : null}
      </div>
    </Card>
  );
}

function ExternalWalletForm({ source }: { source: "IDRX" | "USDC" }) {
  const t = useT();
  const { client: smartClient } = useSmartWallets();
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setError(null);
    setHash(null);
    if (!isAddress(address)) {
      setError(t("withdraw.external.errorAddress"));
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError(t("withdraw.external.errorAmount"));
      return;
    }
    if (!smartClient) {
      setError("Smart wallet not ready");
      return;
    }
    setBusy(true);
    try {
      if (source === "USDC") {
        const amountRaw = parseUnits(
          n.toFixed(USDC_DECIMALS),
          USDC_DECIMALS,
        );
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [getAddress(address), amountRaw],
        });
        const tx = await smartClient.sendTransaction({
          calls: [{ to: USDC_ADDRESS, data, value: BigInt(0) }] as Parameters<
            typeof smartClient.sendTransaction
          >[0] extends { calls: infer C }
            ? C
            : never,
        });
        setHash(typeof tx === "string" ? tx : null);
      } else {
        // IDRX external transfer — handled via existing IDRX contract
        // (same ERC-20 transfer on Base). Omitted here; TODO plumb IDRX token
        // address once the contract module exposes it.
        setError("IDRX external transfer coming soon");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setBusy(false);
    }
  }, [address, amount, smartClient, source, t]);

  return (
    <div className="space-y-3">
      <p
        className="text-[12px]"
        style={{ color: "var(--arka-text-muted)" }}
      >
        {t("withdraw.external.desc")}
      </p>
      <div>
        <Label htmlFor="ext-addr">{t("withdraw.external.address")}</Label>
        <Input
          id="ext-addr"
          autoComplete="off"
          spellCheck={false}
          value={address}
          onChange={(e) => setAddress(e.target.value.trim())}
          placeholder="0x..."
        />
      </div>
      <div>
        <Label htmlFor="ext-amt">{t("withdraw.external.amount")}</Label>
        <Input
          id="ext-amt"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>
      {error ? (
        <p className="text-xs" style={{ color: "var(--arka-danger)" }}>
          {error}
        </p>
      ) : null}
      {hash ? (
        <p className="text-xs" style={{ color: "var(--arka-success)" }}>
          {t("withdraw.external.sent")} ·{" "}
          <a
            href={`https://basescan.org/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono underline"
          >
            {hash.slice(0, 10)}…
          </a>
        </p>
      ) : null}
      <GradButton onClick={submit} disabled={busy}>
        {busy ? t("withdraw.external.sending") : t("withdraw.external.submit")}
      </GradButton>
    </div>
  );
}
