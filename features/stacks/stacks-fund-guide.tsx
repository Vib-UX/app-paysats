"use client";

import { Card } from "@/components/ui/card";
import { GradButton } from "@/components/ui/grad-button";
import { useStacksWallet } from "@/hooks/use-stacks-wallet";
import { useT } from "@/lib/i18n";
import { useCallback, useState } from "react";

const KRAKEN_BUY_STX = "https://www.kraken.com/buy/stx";
const KRAKEN_BUY_USDC = "https://www.kraken.com/buy/usdc";

type Props = {
  /** When true, hide the connect step if already connected. */
  compact?: boolean;
  /** Optional CTA after the guide (e.g. open /stacks). */
  showOpenStacks?: boolean;
};

export function StacksFundGuide({ compact, showOpenStacks }: Props) {
  const t = useT();
  const wallet = useStacksWallet();
  const [copied, setCopied] = useState(false);

  const copyAddress = useCallback(async () => {
    if (!wallet.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }, [wallet.address]);

  return (
    <Card className="space-y-4">
      <div
        className="text-[13px] font-extrabold"
        style={{ color: "var(--paysats-text)" }}
      >
        {t("stacks.fund.title")}
      </div>

      {!compact || !wallet.connected ? (
        <Step
          n={1}
          title={t("stacks.fund.step1Title")}
          desc={t("stacks.fund.step1Desc")}
        >
          {wallet.connected ? (
            <span
              className="text-[12px] font-bold"
              style={{ color: "var(--paysats-success)" }}
            >
              {t("stacks.fund.connected")} · {wallet.address?.slice(0, 6)}…
              {wallet.address?.slice(-4)}
            </span>
          ) : (
            <GradButton
              onClick={() => void wallet.connect()}
              disabled={wallet.connecting}
            >
              {wallet.connecting
                ? t("auth.connecting")
                : t("stacks.fund.step1Cta")}
            </GradButton>
          )}
          {wallet.error ? (
            <p className="text-xs" style={{ color: "var(--paysats-danger)" }}>
              {wallet.error}
            </p>
          ) : null}
        </Step>
      ) : null}

      <Step
        n={compact && wallet.connected ? 1 : 2}
        title={t("stacks.fund.step2Title")}
        desc={t("stacks.fund.step2Desc")}
      >
        <div className="flex flex-wrap gap-2">
          {wallet.address ? (
            <button
              type="button"
              onClick={() => void copyAddress()}
              className="rounded-[10px] px-3 py-2 text-[12px] font-extrabold"
              style={{
                color: "var(--paysats-accent)",
                background: "var(--paysats-accent-soft)",
              }}
              data-pressable
            >
              {copied ? t("stacks.fund.copied") : t("stacks.fund.copy")}
            </button>
          ) : (
            <p
              className="text-[11px]"
              style={{ color: "var(--paysats-text-faint)" }}
            >
              {t("stacks.fund.needConnect")}
            </p>
          )}
          <KrakenLink href={KRAKEN_BUY_STX} label={t("stacks.fund.buyKraken")} />
        </div>
      </Step>

      <Step
        n={compact && wallet.connected ? 2 : 3}
        title={t("stacks.fund.step3Title")}
        desc={t("stacks.fund.step3Desc")}
      >
        <div className="flex flex-wrap gap-2">
          <KrakenLink href={KRAKEN_BUY_USDC} label={t("stacks.fund.buyKraken")} />
          {showOpenStacks ? (
            <a
              href="/stacks"
              className="inline-block rounded-[10px] px-3 py-2 text-[12px] font-extrabold"
              style={{
                color: "var(--paysats-accent)",
                background: "var(--paysats-accent-soft)",
              }}
              data-pressable
            >
              {t("stacks.fund.openStacks")}
            </a>
          ) : null}
        </div>
      </Step>
    </Card>
  );
}

function KrakenLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block rounded-[10px] px-3 py-2 text-[12px] font-extrabold"
      style={{
        color: "var(--paysats-accent)",
        background: "var(--paysats-accent-soft)",
      }}
      data-pressable
    >
      {label}
    </a>
  );
}

function Step({
  n,
  title,
  desc,
  children,
}: {
  n: number;
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold"
        style={{
          background: "var(--paysats-accent-soft)",
          color: "var(--paysats-accent)",
        }}
      >
        {n}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div
          className="text-[13px] font-bold"
          style={{ color: "var(--paysats-text)" }}
        >
          {title}
        </div>
        <div
          className="text-[11px] leading-relaxed"
          style={{ color: "var(--paysats-text-faint)" }}
        >
          {desc}
        </div>
        {children}
      </div>
    </div>
  );
}
