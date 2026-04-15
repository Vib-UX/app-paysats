"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { fetchWithPrivy } from "@/lib/api";
import { CHAIN_OPTIONS, defaultChainId } from "@/lib/chains";
import { useT } from "@/lib/i18n";
import {
  ethereumAddressFromPrivyUser,
  resolveWalletDisplayAddress,
} from "@/lib/privy-destination-wallet";
import {
  useActiveWallet,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const EXPIRY_PRESETS: { labelKey: "expiry.1h" | "expiry.6h" | "expiry.24h"; sec: number }[] = [
  { labelKey: "expiry.1h", sec: 3600 },
  { labelKey: "expiry.6h", sec: 3600 * 6 },
  { labelKey: "expiry.24h", sec: 86400 },
];

type IdrxGate = "loading" | "linking_idrx" | "ready" | "error";

export function MintForm({ walletAddress }: { walletAddress: string | null }) {
  const { getAccessToken, ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { wallet: activeWallet } = useActiveWallet();
  const t = useT();

  const [meWallet, setMeWallet] = useState<string | null>(null);
  const [idrxGate, setIdrxGate] = useState<IdrxGate>("loading");
  const [gateError, setGateError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    void (async () => {
      setGateError(null);
      setIdrxGate("loading");

      const applyMe = (walletAddress: string | null | undefined) => {
        if (typeof walletAddress === "string" && walletAddress) {
          setMeWallet(walletAddress);
        }
      };

      const getStatus = async () => {
        const res = await fetchWithPrivy(getAccessToken, "/api/idrx/onboarding");
        const j = (await res.json().catch(() => ({}))) as {
          completed?: boolean;
          walletAddress?: string | null;
        };
        return { res, j };
      };

      const first = await getStatus();
      if (cancelled) return;
      if (!first.res.ok) {
        setIdrxGate("error");
        return;
      }
      applyMe(first.j.walletAddress);
      if (first.j.completed) {
        setIdrxGate("ready");
        return;
      }

      setIdrxGate("linking_idrx");
      const post = await fetchWithPrivy(getAccessToken, "/api/idrx/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const pj = (await post.json().catch(() => ({}))) as { error?: string };
      if (cancelled) return;
      if (!post.ok) {
        setGateError(pj.error || t("general.failedLoad"));
        setIdrxGate("error");
        return;
      }

      const second = await getStatus();
      if (cancelled) return;
      if (!second.res.ok) {
        setGateError(t("mint.errorDefault"));
        setIdrxGate("error");
        return;
      }
      applyMe(second.j.walletAddress);
      if (second.j.completed) {
        setIdrxGate("ready");
      } else {
        setGateError(t("mint.errorDefault"));
        setIdrxGate("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken, t]);

  const dest = useMemo(
    () =>
      resolveWalletDisplayAddress({
        wallets,
        user,
        activeWallet,
        dbWallet: meWallet ?? walletAddress,
      }) ?? "",
    [wallets, user, activeWallet, meWallet, walletAddress],
  );

  const [amount, setAmount] = useState("");
  const [chainId, setChainId] = useState(defaultChainId());
  const [expiry, setExpiry] = useState(EXPIRY_PRESETS[2].sec);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    paymentUrl: string;
    amount: string;
    reference: string;
    merchantOrderId: string;
  } | null>(null);

  const submit = useCallback(async () => {
    setError(null);
    const raw = amount.replace(/\./g, "").replace(/,/g, "").trim();
    if (!raw || !dest) {
      setError(!dest ? t("mint.errorNoWallet") : t("mint.errorNoAmount"));
      return;
    }
    setLoading(true);
    const res = await fetchWithPrivy(getAccessToken, "/api/idrx/mint-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toBeMinted: raw,
        expiryPeriod: expiry,
        networkChainId: chainId,
        requestType: "idrx",
        destinationWalletAddress: dest,
      }),
    });
    setLoading(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error || t("mint.errorGeneric"));
      return;
    }
    setResult({
      paymentUrl: j.paymentUrl,
      amount: j.amount,
      reference: j.reference,
      merchantOrderId: j.merchantOrderId,
    });
  }, [amount, chainId, dest, expiry, getAccessToken, t]);

  if (idrxGate === "loading" || idrxGate === "linking_idrx") {
    return (
      <Screen
        title={t("mint.title")}
        subtitle={
          idrxGate === "linking_idrx"
            ? t("mint.linkingIdrx")
            : t("mint.checkingIdrx")
        }
      >
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-arka-border" />
          <p className="text-sm text-arka-text-muted">
            {idrxGate === "linking_idrx"
              ? t("mint.linkingWait")
              : t("mint.preparing")}
          </p>
        </div>
      </Screen>
    );
  }

  if (idrxGate === "error") {
    return (
      <Screen
        title={t("mint.title")}
        subtitle={t("mint.errorTitle")}
      >
        <Card className="space-y-3 p-4">
          <p className="text-sm text-arka-danger" role="alert">
            {gateError || t("mint.errorDefault")}
          </p>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title={t("mint.title")}
      subtitle={t("mint.subtitle")}
    >
      <div className="space-y-4">
        <Card className="space-y-3">
          <div>
            <Label>{t("mint.destLabel")}</Label>
            <p className="mt-1 break-all font-mono text-xs text-arka-text-muted">
              {dest || t("mint.destWaiting")}
            </p>
          </div>
          <div>
            <Label htmlFor="amt">{t("mint.amountLabel")}</Label>
            <Input
              id="amt"
              inputMode="numeric"
              placeholder={t("mint.amountPlaceholder")}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="mt-1 text-xs text-arka-text-muted">
              {t("mint.amountHint")}
            </p>
          </div>
          <div>
            <Label htmlFor="chain">{t("mint.networkLabel")}</Label>
            <select
              id="chain"
              className="min-h-11 w-full rounded-[var(--radius-control)] border border-arka-border bg-arka-surface px-3 text-base"
              value={chainId}
              onChange={(e) => setChainId(e.target.value)}
            >
              {CHAIN_OPTIONS.map((c) => (
                <option key={c.id} value={c.networkChainId}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-arka-text-muted">
              {t("mint.networkHint")}
            </p>
          </div>
          <div>
            <Label>{t("mint.expiryLabel")}</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXPIRY_PRESETS.map((p) => (
                <button
                  key={p.sec}
                  type="button"
                  onClick={() => setExpiry(p.sec)}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    expiry === p.sec
                      ? "bg-arka-accent text-white"
                      : "bg-arka-surface-muted text-arka-text"
                  }`}
                >
                  {t(p.labelKey)}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {error ? (
          <p className="text-sm text-arka-danger" role="alert">
            {error}
          </p>
        ) : null}

        {result ? (
          <Card className="space-y-3 border-arka-accent/30 bg-amber-50/40">
            <p className="text-sm font-medium text-arka-text">
              {t("mint.resultTitle")}
            </p>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-arka-text-muted">{t("mint.resultTotalPay")}</dt>
                <dd className="font-medium">Rp {result.amount}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-arka-text-muted">{t("mint.resultReference")}</dt>
                <dd className="max-w-[55%] truncate font-mono text-xs">
                  {result.reference}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-arka-text-muted">{t("mint.resultOrder")}</dt>
                <dd className="font-mono text-xs">{result.merchantOrderId}</dd>
              </div>
            </dl>
            <a
              href={result.paymentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] bg-arka-accent px-4 text-sm font-medium text-white transition hover:bg-arka-accent-muted active:scale-[0.99]"
            >
              {t("mint.resultPayBtn")}
            </a>

            {/* Processing delay notice */}
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/60 bg-amber-50/60 px-3 py-2.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-arka-warning">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <p className="text-xs leading-relaxed text-arka-text-muted">
                {t("mint.processingNotice")}
              </p>
            </div>

            <p className="text-xs text-arka-text-muted">
              {t("mint.resultTrackPrefix")}{" "}
              <Link
                href={`/activity?merchantOrderId=${encodeURIComponent(result.merchantOrderId)}`}
                className="font-medium text-arka-accent underline"
              >
                {t("mint.resultActivityLink")}
              </Link>{" "}
              {t("mint.resultTrackSuffix")}
            </p>
          </Card>
        ) : (
          <Button onClick={submit} disabled={loading}>
            {loading ? t("mint.submitting") : t("mint.submit")}
          </Button>
        )}
      </div>
    </Screen>
  );
}
