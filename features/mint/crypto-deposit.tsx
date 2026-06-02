"use client";

import { Card } from "@/components/ui/card";
import { resolveWalletDisplayAddress } from "@/lib/privy-destination-wallet";
import { useT } from "@/lib/i18n";
import {
  useActiveWallet,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState } from "react";

export function CryptoDeposit({ token }: { token: "USDC" }) {
  const t = useT();
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const { wallet: activeWallet } = useActiveWallet();
  const [copied, setCopied] = useState(false);

  const address = useMemo(
    () =>
      resolveWalletDisplayAddress({
        wallets,
        user,
        activeWallet,
        dbWallet: null,
      }) ?? "",
    [wallets, user, activeWallet],
  );

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <Card className="space-y-3">
      <div
        className="rounded-[16px] p-4"
        style={{ background: "var(--paysats-surface-muted)" }}
      >
        <div
          className="mx-auto flex h-44 w-44 items-center justify-center rounded-[14px] bg-white p-2.5"
          style={{
            boxShadow: "var(--paysats-shadow-card)",
          }}
          aria-label={`QR code for ${token} on Base`}
        >
          {address ? (
            <QRCodeSVG
              value={address}
              size={160}
              bgColor="#ffffff"
              fgColor="#1a120b"
              level="M"
              marginSize={0}
            />
          ) : (
            <div
              className="text-[11px]"
              style={{ color: "var(--paysats-text-faint)" }}
            >
              {t("addfunds.waitingAddress")}
            </div>
          )}
        </div>
        <div
          className="mt-3 text-center text-[12px] font-bold"
          style={{ color: "var(--paysats-text)" }}
        >
          {token} · Base
        </div>
      </div>

      <div>
        <div
          className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em]"
          style={{ color: "var(--paysats-text-faint)" }}
        >
          {t("addfunds.yourAddress")}
        </div>
        <button
          type="button"
          onClick={copy}
          data-pressable
          className="flex w-full items-center justify-between gap-2 rounded-[12px] border px-3 py-2.5 text-left"
          style={{
            background: "var(--paysats-surface)",
            borderColor: "var(--paysats-border)",
          }}
        >
          <span
            className="truncate font-mono text-[12px]"
            style={{ color: "var(--paysats-text)" }}
          >
            {address || "—"}
          </span>
          <span
            className="shrink-0 rounded-[8px] px-2 py-1 text-[10px] font-extrabold"
            style={{
              background: "var(--paysats-accent-soft)",
              color: "var(--paysats-accent)",
            }}
          >
            {copied ? t("addfunds.copied") : t("addfunds.copyAddress")}
          </span>
        </button>
      </div>

      <div
        className="rounded-[12px] p-3 text-[11px]"
        style={{
          background: "var(--paysats-warning-soft)",
          color: "var(--paysats-warning)",
        }}
      >
        {t("addfunds.warning")}
      </div>
    </Card>
  );
}
