"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchWithPrivy } from "@/lib/api";
import { defaultChainId } from "@/lib/chains";
import { IDRX_DECIMALS, INTERVAL_PRESETS } from "@/lib/contracts/arka-dca";
import { useDcaOrder } from "@/hooks/use-dca-contract";
import { resolveWalletDisplayAddress } from "@/lib/privy-destination-wallet";
import { TransactionList } from "@/features/transactions/transaction-list";
import type { MintTransaction } from "@/types/transaction";
import {
  useActiveWallet,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type BalanceTab = "IDRX" | "BTC";

function shortenAddr(a: string) {
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function DcaDashboardCard() {
  const { order, loading } = useDcaOrder();

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
    const freqLabel = intervalMatch?.label ?? `${Number(order.interval)}s`;
    const remaining =
      order.totalSwaps === BigInt(0)
        ? "tanpa batas"
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
                <p className="text-sm font-medium text-arka-text">DCA Aktif</p>
              </div>
              <p className="mt-1 text-xs text-arka-text-muted">
                Rp {perSwapIdr.toLocaleString("id-ID")} · {freqLabel} ·{" "}
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
              DCA otomatis IDRX → cbBTC
            </p>
            <p className="mt-1 text-xs text-arka-text-muted">
              Jadwalkan pembelian Bitcoin otomatis dari saldo IDRX kamu.
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
  const [txItems, setTxItems] = useState<MintTransaction[] | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const getAccessTokenRef = useRef(getAccessToken);
  useLayoutEffect(() => {
    getAccessTokenRef.current = getAccessToken;
  }, [getAccessToken]);

  /** Hindari setState dari fetch lawas saat `loadBalances` dipanggil ulang. */
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

    const q = qs.toString();
    const tokenFn = getAccessTokenRef.current;

    /**
     * Jangan `Promise.all` pada kedua fetch: kalau `/api/wallet/btc-balance`
     * lambat atau hang (RPC on-chain), saldo IDRX tidak pernah diproses meski 200 OK.
     */
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
              ? n.toLocaleString("id-ID", { maximumFractionDigits: 6 })
              : String(raw),
          );
          setIdrxState("ready");
        } else {
          setIdrxFormatted(null);
          setIdrxState("error");
          setIdrxErrorHint(
            idrxJ.error ?? (idrxRes.ok ? null : "Gagal memuat saldo"),
          );
        }
      } catch {
        if (gen !== balanceFetchGen.current) return;
        setIdrxFormatted(null);
        setIdrxState("error");
        setIdrxErrorHint("Gagal memuat saldo");
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
              sats.toLocaleString("id-ID", { maximumFractionDigits: 0 }),
            );
          } else {
            const n = Number(btcJ.balanceFormatted);
            const fallbackSats = Number.isFinite(n) ? Math.round(n * 1e8) : 0;
            setBtcFormatted(
              fallbackSats.toLocaleString("id-ID", { maximumFractionDigits: 0 }),
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

    await Promise.allSettled([runIdrx(), runBtc()]);
  }, [resolvedAddress]);

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
      setTxError(j.error || "Gagal memuat");
      setTxItems([]);
      return;
    }
    setTxItems(j.transactions ?? []);
  }, []);

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

  const balanceLabel =
    tab === "IDRX"
      ? waitingWallet
        ? "Memuat dompet…"
        : idrxLoading
          ? "Memuat…"
          : idrxState === "ready" && idrxFormatted != null
            ? idrxFormatted
            : "—"
      : waitingWallet
        ? "Memuat dompet…"
        : btcLoading
          ? "Memuat…"
          : btcConfigured === false
            ? "—"
            : btcState === "ready" && btcFormatted != null
              ? btcFormatted
              : "—";

  const balanceUnit = tab === "IDRX" ? "IDRX" : btcSymbol;
  const balanceTitle =
    tab === "IDRX" ? "Saldo IDRX" : "Saldo cbBTC (sats)";

  return (
    <div className="px-4 pb-28 pt-4">
      <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-arka-accent via-arka-accent to-arka-accent-muted p-5 text-white shadow-md">
        <div className="absolute right-3 top-3 text-2xl font-semibold opacity-20">
          {tab === "IDRX" ? "Rp" : "₿"}
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
            Set{" "}
            <code className="rounded bg-black/20 px-1">NEXT_PUBLIC_BTC_ERC20_ADDRESS</code>{" "}
            ke cbBTC Base (satu alamat, 42 karakter).
          </p>
        ) : null}
        {tab === "BTC" && btcState === "error" ? (
          <p className="mt-2 text-xs text-white/85">
            Gagal membaca saldo cbBTC — periksa RPC dan alamat kontrak.
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
              {copied ? "Disalin" : "Salin"}
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
            Dompet Privy belum terdeteksi. Buka Profil atau tunggu sinkronisasi.
          </p>
        )}
      </section>

      <section className="mt-5">
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-arka-text">
              Deposit IDR → IDRX
            </p>
            <p className="mt-1 text-xs text-arka-text-muted">
              Virtual account & mint lewat alur deposit yang sama seperti
              sebelumnya.
            </p>
          </div>
          <Link href="/mint" className="shrink-0">
            <Button type="button" variant="primary" className="w-auto min-w-[7rem]">
              Deposit
            </Button>
          </Link>
        </Card>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-arka-text-muted">
            Tabungan kamu
          </h2>
          <Link
            href="/savings"
            className="text-xs font-medium text-arka-accent hover:underline"
          >
            Lihat semua
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="border-dashed bg-arka-surface-muted/50">
            <p className="text-sm font-medium text-arka-text">Contoh: dana darurat</p>
            <p className="mt-2 text-xs text-arka-text-muted">
              Nanti kamu bisa bagi alokasi BTC per tujuan tabungan.
            </p>
          </Card>
          <Card className="border-dashed bg-arka-surface-muted/50">
            <p className="text-sm font-medium text-arka-text">Contoh: liburan</p>
            <p className="mt-2 text-xs text-arka-text-muted">
              Data tabungan sungguhan menyusul di versi berikutnya.
            </p>
          </Card>
        </div>
      </section>

      <DcaDashboardCard />

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-arka-text-muted">
            Aktivitas deposit
          </h2>
          <Link
            href="/activity"
            className="text-xs font-medium text-arka-accent hover:underline"
          >
            Lihat semua
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
