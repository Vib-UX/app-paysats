"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchWithPrivy } from "@/lib/api";
import { defaultChainId } from "@/lib/chains";
import { IDRX_DECIMALS, INTERVAL_PRESETS, erc20Abi } from "@/lib/contracts/arka-dca";
import { USDC_ADDRESS, USDC_DECIMALS } from "@/lib/contracts/morpho-credit";
import { getBasePublicClient } from "@/lib/base-client";
import { useDcaOrder } from "@/hooks/use-dca-contract";
import { useCreditPosition, formatUsdc, formatCbBtc } from "@/hooks/use-credit-line";
import { useLocale, useT } from "@/lib/i18n";
import { resolveWalletDisplayAddress } from "@/lib/privy-destination-wallet";
import { TransactionList } from "@/features/transactions/transaction-list";
import type { MintTransaction } from "@/types/transaction";
import {
  useActiveWallet,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import Link from "next/link";
import { formatUnits } from "viem";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type BalanceTab = "IDRX" | "BTC" | "USDC";

function shortenAddr(a: string) {
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function DcaDashboardCard() {
  const { order, loading } = useDcaOrder();
  const t = useT();
  const { locale } = useLocale();

  if (loading) {
    return (
      <section className="mt-6">
        <Card className="flex items-start gap-3 border-arka-border/80 bg-arka-surface-muted/40">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-arka-border bg-arka-surface text-xs font-semibold text-arka-text-muted"
            aria-hidden
          >
            DCA
          </div>
          <div className="flex-1">
            <div className="h-4 w-24 animate-pulse rounded bg-arka-border/60" />
            <div className="mt-2 h-3 w-40 animate-pulse rounded bg-arka-border/40" />
          </div>
        </Card>
      </section>
    );
  }

  if (order) {
    const perSwapIdr = Number(order.amountPerSwap) / 10 ** IDRX_DECIMALS;
    const intervalMatch = INTERVAL_PRESETS.find(
      (p) => p.seconds === Number(order.interval),
    );
    const intervalKeys: Record<number, string> = {
      86_400: "dca.interval.daily",
      604_800: "dca.interval.weekly",
      2_592_000: "dca.interval.monthly",
    };
    const freqLabel = intervalMatch
      ? t(intervalKeys[intervalMatch.seconds] as Parameters<typeof t>[0])
      : `${Number(order.interval)}s`;
    const remaining =
      order.totalSwaps === BigInt(0)
        ? t("dashboard.unlimitedSwaps")
        : `${order.executedSwaps}/${order.totalSwaps}`;

    return (
      <section className="mt-6">
        <Link href="/dca">
          <Card className="flex items-start gap-3 border-green-300/40 bg-green-50/20">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-xs font-semibold text-green-700">
              DCA
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                <p className="text-sm font-medium text-arka-text">{t("dashboard.dcaActive")}</p>
              </div>
              <p className="mt-1 text-xs text-arka-text-muted">
                Rp {perSwapIdr.toLocaleString(locale === "id" ? "id-ID" : "en-US")} · {freqLabel} ·{" "}
                {remaining}
              </p>
            </div>
          </Card>
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <Link href="/dca">
        <Card className="flex items-start gap-3 border-arka-border/80 bg-arka-surface-muted/40 transition hover:border-arka-accent/30">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-arka-border bg-arka-surface text-xs font-semibold text-arka-text-muted"
            aria-hidden
          >
            DCA
          </div>
          <div>
            <p className="text-sm font-medium text-arka-text">
              {t("dashboard.dcaAutoTitle")}
            </p>
            <p className="mt-1 text-xs text-arka-text-muted">
              {t("dashboard.dcaAutoDesc")}
            </p>
          </div>
        </Card>
      </Link>
    </section>
  );
}

const ZONE_DOT: Record<string, string> = {
  safe: "bg-green-500",
  warning: "bg-yellow-500",
  danger: "bg-red-500",
};

function CreditDashboardCard() {
  const { data, loading } = useCreditPosition();
  const t = useT();
  const { locale } = useLocale();
  const localeStr = locale === "id" ? "id-ID" : "en-US";

  if (loading || !data) return null;

  const hasPosition =
    data.position.collateral > BigInt(0) || data.position.borrowShares > BigInt(0);
  const hasBtc = data.cbBtcBalance > BigInt(0);

  if (!hasPosition && !hasBtc) return null;

  if (hasPosition) {
    const dot = ZONE_DOT[data.health.zone] ?? "bg-gray-400";
    return (
      <section className="mt-4">
        <Link href="/credit">
          <Card className="flex items-start gap-3 border-arka-accent/30 bg-gradient-to-r from-arka-surface to-amber-50/20">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-arka-accent/10 text-sm font-bold text-arka-accent">
              $
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
                <p className="text-sm font-medium text-arka-text">
                  {t("credit.dashboardActiveLabel")}
                </p>
              </div>
              <p className="mt-1 text-xs text-arka-text-muted">
                {formatCbBtc(data.position.collateral, localeStr)} BTC · $
                {formatUsdc(data.borrowedAssets, localeStr)} USDC
              </p>
            </div>
          </Card>
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-4">
      <Link href="/credit">
        <Card className="flex items-start gap-3 border-arka-border/80 bg-arka-surface-muted/40 transition hover:border-arka-accent/30">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-arka-border bg-arka-surface text-sm font-bold text-arka-text-muted">
            $
          </div>
          <div>
            <p className="text-sm font-medium text-arka-text">
              {t("credit.dashboardTeaser")}
            </p>
            <p className="mt-1 text-xs text-arka-text-muted">
              {t("credit.dashboardTeaserDesc")}
            </p>
          </div>
        </Card>
      </Link>
    </section>
  );
}

export function DashboardClient() {
  const { getAccessToken, ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { wallet: activeWallet } = useActiveWallet();
  const t = useT();
  const { locale } = useLocale();
  const localeStr = locale === "id" ? "id-ID" : "en-US";

  const [tab, setTab] = useState<BalanceTab>("IDRX");
  const [dbWallet, setDbWallet] = useState<string | null>(null);
  const [idrxFormatted, setIdrxFormatted] = useState<string | null>(null);
  const [idrxState, setIdrxState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [idrxErrorHint, setIdrxErrorHint] = useState<string | null>(null);
  const [btcFormatted, setBtcFormatted] = useState<string | null>(null);
  const [btcSymbol, setBtcSymbol] = useState<string>("sats");
  const [btcConfigured, setBtcConfigured] = useState<boolean | null>(null);
  const [btcState, setBtcState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [usdcFormatted, setUsdcFormatted] = useState<string | null>(null);
  const [usdcState, setUsdcState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [txItems, setTxItems] = useState<MintTransaction[] | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const getAccessTokenRef = useRef(getAccessToken);
  useLayoutEffect(() => {
    getAccessTokenRef.current = getAccessToken;
  }, [getAccessToken]);

  const balanceFetchGen = useRef(0);

  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    void (async () => {
      const res = await fetchWithPrivy(getAccessTokenRef.current, "/api/user/me");
      const j = (await res.json().catch(() => ({}))) as {
        walletAddress?: string | null;
      };
      if (cancelled) return;
      if (res.ok && typeof j.walletAddress === "string" && j.walletAddress) {
        setDbWallet(j.walletAddress);
      } else {
        setDbWallet(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated]);

  const resolvedAddress = useMemo(
    () =>
      resolveWalletDisplayAddress({
        wallets,
        user,
        activeWallet,
        dbWallet,
      }),
    [wallets, user, activeWallet, dbWallet],
  );

  const loadBalances = useCallback(async () => {
    if (!resolvedAddress) {
      balanceFetchGen.current += 1;
      setIdrxState("idle");
      setIdrxFormatted(null);
      setIdrxErrorHint(null);
      setBtcState("idle");
      setBtcFormatted(null);
      setBtcConfigured(null);
      setUsdcState("idle");
      setUsdcFormatted(null);
      return;
    }
    const gen = ++balanceFetchGen.current;
    const chain = defaultChainId();
    const qs = new URLSearchParams({
      networkChainId: chain,
      walletAddress: resolvedAddress,
    });

    setIdrxState("loading");
    setIdrxErrorHint(null);
    setBtcState("loading");
    setUsdcState("loading");

    const q = qs.toString();
    const tokenFn = getAccessTokenRef.current;

    const runIdrx = async () => {
      try {
        const idrxRes = await fetchWithPrivy(
          tokenFn,
          `/api/idrx/balance?${q}`,
        );
        const idrxJ = (await idrxRes.json().catch(() => ({}))) as {
          balanceFormatted?: string | number | null;
          error?: string;
        };
        if (gen !== balanceFetchGen.current) return;
        if (idrxRes.ok && idrxJ.balanceFormatted != null && !idrxJ.error) {
          const raw = idrxJ.balanceFormatted;
          const n = typeof raw === "number" ? raw : Number(raw);
          setIdrxFormatted(
            Number.isFinite(n)
              ? n.toLocaleString(localeStr, { maximumFractionDigits: 6 })
              : String(raw),
          );
          setIdrxState("ready");
        } else {
          setIdrxFormatted(null);
          setIdrxState("error");
          setIdrxErrorHint(
            idrxJ.error ?? (idrxRes.ok ? null : t("dashboard.failedLoadBalance")),
          );
        }
      } catch {
        if (gen !== balanceFetchGen.current) return;
        setIdrxFormatted(null);
        setIdrxState("error");
        setIdrxErrorHint(t("dashboard.failedLoadBalance"));
      }
    };

    const runBtc = async () => {
      try {
        const btcRes = await fetchWithPrivy(
          tokenFn,
          `/api/wallet/btc-balance?${q}`,
          typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
            ? { signal: AbortSignal.timeout(25_000) }
            : {},
        );
        const btcJ = (await btcRes.json().catch(() => ({}))) as {
          configured?: boolean;
          balanceRaw?: string | null;
          balanceFormatted?: string | number | null;
          symbol?: string;
          error?: string;
        };
        if (gen !== balanceFetchGen.current) return;
        if (btcJ.configured === false) {
          setBtcConfigured(false);
          setBtcFormatted(null);
          setBtcState("ready");
        } else if (btcRes.ok && !btcJ.error && (btcJ.balanceRaw != null || btcJ.balanceFormatted != null)) {
          setBtcConfigured(true);
          setBtcSymbol("sats");

          const sats = btcJ.balanceRaw != null ? Number(btcJ.balanceRaw) : null;
          if (sats != null && Number.isFinite(sats)) {
            setBtcFormatted(
              sats.toLocaleString(localeStr, { maximumFractionDigits: 0 }),
            );
          } else {
            const n = Number(btcJ.balanceFormatted);
            const fallbackSats = Number.isFinite(n) ? Math.round(n * 1e8) : 0;
            setBtcFormatted(
              fallbackSats.toLocaleString(localeStr, { maximumFractionDigits: 0 }),
            );
          }
          setBtcState("ready");
        } else {
          setBtcConfigured(true);
          setBtcFormatted(null);
          setBtcState("error");
        }
      } catch {
        if (gen !== balanceFetchGen.current) return;
        setBtcConfigured(true);
        setBtcFormatted(null);
        setBtcState("error");
      }
    };

    const runUsdc = async () => {
      try {
        const pc = getBasePublicClient();
        const rawBalance = await pc.readContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [resolvedAddress as `0x${string}`],
        });
        if (gen !== balanceFetchGen.current) return;
        const n = Number(formatUnits(rawBalance, USDC_DECIMALS));
        setUsdcFormatted(
          n.toLocaleString(localeStr, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
          }),
        );
        setUsdcState("ready");
      } catch {
        if (gen !== balanceFetchGen.current) return;
        setUsdcFormatted(null);
        setUsdcState("error");
      }
    };

    await Promise.allSettled([runIdrx(), runBtc(), runUsdc()]);
  }, [resolvedAddress, localeStr, t]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    void (async () => {
      await loadBalances();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, loadBalances]);

  const loadTx = useCallback(async () => {
    setTxError(null);
    const q = new URLSearchParams({ page: "1", take: "5" });
    const res = await fetchWithPrivy(
      getAccessTokenRef.current,
      `/api/idrx/transactions?${q.toString()}`,
    );
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTxError(j.error || t("general.failedLoad"));
      setTxItems([]);
      return;
    }
    setTxItems(j.transactions ?? []);
  }, [t]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadTx();
    });
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, loadTx]);

  const explorerUrl = resolvedAddress
    ? `https://basescan.org/address/${resolvedAddress}`
    : null;

  const copyAddress = () => {
    if (!resolvedAddress) return;
    void navigator.clipboard.writeText(resolvedAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!ready || !authenticated) return null;

  const waitingWallet = !resolvedAddress;

  const idrxLoading =
    idrxState === "loading" ||
    (idrxState === "idle" && Boolean(resolvedAddress));
  const btcLoading =
    btcState === "loading" ||
    (btcState === "idle" && Boolean(resolvedAddress));
  const usdcLoading =
    usdcState === "loading" ||
    (usdcState === "idle" && Boolean(resolvedAddress));

  const balanceLabel =
    tab === "IDRX"
      ? waitingWallet
        ? t("dashboard.loadingWallet")
        : idrxLoading
          ? t("dashboard.loading")
          : idrxState === "ready" && idrxFormatted != null
            ? idrxFormatted
            : "—"
      : tab === "BTC"
        ? waitingWallet
          ? t("dashboard.loadingWallet")
          : btcLoading
            ? t("dashboard.loading")
            : btcConfigured === false
              ? "—"
              : btcState === "ready" && btcFormatted != null
                ? btcFormatted
                : "—"
        : waitingWallet
          ? t("dashboard.loadingWallet")
          : usdcLoading
            ? t("dashboard.loading")
            : usdcState === "ready" && usdcFormatted != null
              ? usdcFormatted
              : "—";

  const balanceUnit =
    tab === "IDRX" ? "IDRX" : tab === "BTC" ? btcSymbol : "USDC";
  const balanceTitle =
    tab === "IDRX"
      ? t("dashboard.balanceIdrx")
      : tab === "BTC"
        ? t("dashboard.balanceBtc")
        : t("dashboard.balanceUsdc");

  return (
    <div className="px-4 pb-28 pt-4">
      {/* Balance card */}
      <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-arka-accent via-arka-accent to-arka-accent-muted p-5 text-white shadow-md">
        <div className="absolute right-3 top-3 text-2xl font-semibold opacity-20">
          {tab === "IDRX" ? "Rp" : tab === "BTC" ? "₿" : "$"}
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-white/80">
          {balanceTitle}
        </p>
        <div className="mt-3 inline-flex rounded-lg bg-black/15 p-0.5">
          <button
            type="button"
            onClick={() => setTab("IDRX")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              tab === "IDRX"
                ? "bg-white text-arka-accent shadow-sm"
                : "text-white/90 hover:bg-white/10"
            }`}
          >
            IDRX
          </button>
          <button
            type="button"
            onClick={() => setTab("BTC")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              tab === "BTC"
                ? "bg-white text-arka-accent shadow-sm"
                : "text-white/90 hover:bg-white/10"
            }`}
          >
            cbBTC
          </button>
          <button
            type="button"
            onClick={() => setTab("USDC")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              tab === "USDC"
                ? "bg-white text-arka-accent shadow-sm"
                : "text-white/90 hover:bg-white/10"
            }`}
          >
            USDC
          </button>
        </div>
        <p className="mt-4 font-mono text-3xl font-semibold tabular-nums tracking-tight">
          {balanceLabel}
          <span className="ml-2 text-lg font-medium text-white/90">
            {balanceUnit}
          </span>
        </p>
        {tab === "IDRX" && idrxState === "error" && idrxErrorHint ? (
          <p className="mt-2 text-xs text-white/85">{idrxErrorHint}</p>
        ) : null}
        {tab === "BTC" && btcConfigured === false ? (
          <p className="mt-2 text-xs text-white/80">
            {t("dashboard.setBtcEnv")}
          </p>
        ) : null}
        {tab === "BTC" && btcState === "error" ? (
          <p className="mt-2 text-xs text-white/85">
            {t("dashboard.failedLoadBtc")}
          </p>
        ) : null}
        {tab === "USDC" && usdcState === "error" ? (
          <p className="mt-2 text-xs text-white/85">
            {t("dashboard.failedLoadUsdc")}
          </p>
        ) : null}
        {resolvedAddress ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/20 pt-4 text-xs text-white/90">
            <span className="font-mono">{shortenAddr(resolvedAddress)}</span>
            <button
              type="button"
              onClick={copyAddress}
              className="rounded-md bg-white/15 px-2 py-1 text-[11px] font-medium hover:bg-white/25"
            >
              {copied ? t("dashboard.copied") : t("dashboard.copy")}
            </button>
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-white/15 px-2 py-1 text-[11px] font-medium hover:bg-white/25"
              >
                Basescan
              </a>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-xs text-white/80">
            {t("dashboard.walletNotDetected")}
          </p>
        )}
      </section>

      {/* Deposit IDR → IDRX CTA */}
      <section className="mt-5">
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-arka-accent/10 text-sm">💱</span>
              <p className="text-sm font-medium text-arka-text">
                {t("dashboard.depositIdr")}
              </p>
            </div>
            <p className="mt-1.5 text-xs text-arka-text-muted">
              {t("dashboard.depositDesc")}
            </p>
          </div>
          <Link href="/mint" className="shrink-0">
            <Button type="button" variant="primary" className="w-auto min-w-[7rem]">
              {t("dashboard.depositBtn")}
            </Button>
          </Link>
        </Card>
      </section>

      <DcaDashboardCard />

      <CreditDashboardCard />

      {/* Simulator teaser */}
      <section className="mt-4">
        <Link href="/savings">
          <Card className="flex items-start gap-3 border-arka-border/80 bg-gradient-to-r from-arka-surface to-amber-50/30 transition hover:border-arka-accent/30">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-lg">
              📊
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-arka-text">
                {t("dashboard.simTitle")}
              </p>
              <p className="mt-1 text-xs text-arka-text-muted">
                {t("dashboard.simDesc")}
              </p>
            </div>
            <span className="shrink-0 self-center rounded-full bg-arka-accent/10 px-3 py-1 text-xs font-medium text-arka-accent">
              {t("dashboard.simBtn")}
            </span>
          </Card>
        </Link>
      </section>

      {/* Activity */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-arka-text-muted">
            {t("dashboard.recentActivity")}
          </h2>
          <Link
            href="/activity"
            className="text-xs font-medium text-arka-accent hover:underline"
          >
            {t("dashboard.viewAll")}
          </Link>
        </div>
        {txError ? (
          <p className="mb-3 text-sm text-arka-danger" role="alert">
            {txError}
          </p>
        ) : null}
        {txItems === null ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-[var(--radius-card)] bg-arka-border/60"
              />
            ))}
          </div>
        ) : (
          <TransactionList items={txItems} />
        )}
      </section>
    </div>
  );
}
