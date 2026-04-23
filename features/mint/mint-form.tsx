"use client";

import { Card } from "@/components/ui/card";
import { GradButton } from "@/components/ui/grad-button";
import { fetchWithPrivy } from "@/lib/api";
import { defaultChainId } from "@/lib/chains";
import { useT } from "@/lib/i18n";
import { resolveWalletDisplayAddress } from "@/lib/privy-destination-wallet";
import {
  useActiveWallet,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_EXPIRY_SEC = 3600;
const IDR_PRESETS = [50_000, 100_000, 250_000, 500_000];

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

  const [amountIdr, setAmountIdr] = useState<number>(100_000);
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
    if (!dest) {
      setError(t("mint.errorNoWallet"));
      return;
    }
    if (!amountIdr || amountIdr < 1) {
      setError(t("mint.errorNoAmount"));
      return;
    }
    setLoading(true);
    const res = await fetchWithPrivy(getAccessToken, "/api/idrx/mint-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toBeMinted: String(Math.floor(amountIdr)),
        expiryPeriod: DEFAULT_EXPIRY_SEC,
        networkChainId: defaultChainId(),
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
  }, [amountIdr, dest, getAccessToken, t]);

  if (idrxGate === "loading" || idrxGate === "linking_idrx") {
    return (
      <Card className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-pulse rounded-full bg-arka-border" />
        <p
          className="text-sm"
          style={{ color: "var(--arka-text-muted)" }}
        >
          {idrxGate === "linking_idrx"
            ? t("mint.linkingIdrx")
            : t("mint.preparing")}
        </p>
      </Card>
    );
  }

  if (idrxGate === "error") {
    return (
      <Card className="space-y-3">
        <div
          className="text-[13px] font-extrabold"
          style={{ color: "var(--arka-text)" }}
        >
          {t("mint.errorTitle")}
        </div>
        <p
          className="text-[12px]"
          style={{ color: "var(--arka-danger)" }}
          role="alert"
        >
          {gateError || t("mint.errorDefault")}
        </p>
      </Card>
    );
  }

  if (result) {
    return (
      <div className="space-y-4">
        <Card className="space-y-3">
          <div
            className="text-[13px] font-extrabold"
            style={{ color: "var(--arka-text)" }}
          >
            {t("mint.resultTitle")}
          </div>
          <dl className="space-y-2 text-[12px]">
            <div className="flex justify-between gap-2">
              <dt style={{ color: "var(--arka-text-muted)" }}>
                {t("mint.resultTotalPay")}
              </dt>
              <dd
                className="font-extrabold tabular-nums"
                style={{ color: "var(--arka-text)" }}
              >
                Rp {result.amount}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt style={{ color: "var(--arka-text-muted)" }}>
                {t("mint.resultReference")}
              </dt>
              <dd
                className="max-w-[55%] truncate font-mono text-[11px]"
                style={{ color: "var(--arka-text)" }}
              >
                {result.reference}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt style={{ color: "var(--arka-text-muted)" }}>
                {t("mint.resultOrder")}
              </dt>
              <dd
                className="font-mono text-[11px]"
                style={{ color: "var(--arka-text)" }}
              >
                {result.merchantOrderId}
              </dd>
            </div>
          </dl>

          <a
            href={result.paymentUrl}
            data-pressable
            className="block w-full rounded-[14px] px-4 py-3 text-center text-[13px] font-extrabold text-white"
            style={{
              background: "var(--arka-gradient)",
              boxShadow: "var(--arka-shadow-hero)",
            }}
          >
            {t("mint.resultPayBtn")}
          </a>

          <div
            className="flex items-start gap-2 rounded-[12px] p-3 text-[11px]"
            style={{
              background: "var(--arka-warning-soft)",
              color: "var(--arka-warning)",
            }}
          >
            <span aria-hidden>⏱</span>
            <span>{t("mint.processingNotice")}</span>
          </div>

          <p
            className="text-[11px]"
            style={{ color: "var(--arka-text-faint)" }}
          >
            {t("mint.resultTrackPrefix")}{" "}
            <Link
              href={`/activity?merchantOrderId=${encodeURIComponent(result.merchantOrderId)}`}
              className="font-extrabold underline"
              style={{ color: "var(--arka-accent)" }}
            >
              {t("mint.resultActivityLink")}
            </Link>{" "}
            {t("mint.resultTrackSuffix")}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <div
            className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ color: "var(--arka-text-muted)" }}
          >
            {t("mint.amountLabel")}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {IDR_PRESETS.map((p) => {
              const active = amountIdr === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmountIdr(p)}
                  className="rounded-[12px] px-2 py-2 text-[12px] font-extrabold"
                  style={{
                    color: active ? "#fff" : "var(--arka-text)",
                    background: active
                      ? "var(--arka-accent)"
                      : "var(--arka-surface-muted)",
                  }}
                  data-pressable
                >
                  {(p / 1000).toFixed(0)}K
                </button>
              );
            })}
          </div>
          <input
            type="number"
            inputMode="numeric"
            value={amountIdr}
            onChange={(e) => setAmountIdr(Number(e.target.value) || 0)}
            placeholder={t("mint.amountPlaceholder")}
            className="mt-3 w-full rounded-[12px] border px-3 py-2 text-[14px] font-semibold tabular-nums"
            style={{
              borderColor: "var(--arka-border)",
              background: "var(--arka-surface)",
              color: "var(--arka-text)",
            }}
          />
          <p
            className="mt-1.5 text-[11px]"
            style={{ color: "var(--arka-text-faint)" }}
          >
            {t("mint.amountHint")}
          </p>
        </div>

        <div
          className="rounded-[12px] p-2.5"
          style={{ background: "var(--arka-surface-muted)" }}
        >
          <div
            className="text-[10px] font-bold uppercase tracking-[0.08em]"
            style={{ color: "var(--arka-text-faint)" }}
          >
            {t("mint.destLabel")}
          </div>
          <div
            className="mt-1 truncate font-mono text-[11px]"
            style={{ color: "var(--arka-text)" }}
          >
            {dest || t("mint.destWaiting")}
          </div>
        </div>
      </Card>

      {error ? (
        <p
          className="text-[12px]"
          style={{ color: "var(--arka-danger)" }}
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <GradButton onClick={submit} disabled={loading || !dest}>
        {loading ? t("mint.submitting") : t("mint.submit")}
      </GradButton>
    </div>
  );
}
