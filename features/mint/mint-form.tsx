"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { fetchWithPrivy } from "@/lib/api";
import { CHAIN_OPTIONS, defaultChainId } from "@/lib/chains";
import {
  ethereumAddressFromPrivyUser,
  pickEthereumDestinationWallet,
} from "@/lib/privy-destination-wallet";
import {
  useActiveWallet,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isAddress } from "viem";

const EXPIRY_PRESETS: { label: string; sec: number }[] = [
  { label: "1 jam", sec: 3600 },
  { label: "6 jam", sec: 3600 * 6 },
  { label: "24 jam", sec: 86400 },
];

type IdrxGate = "loading" | "linking_idrx" | "ready" | "error";

export function MintForm({ walletAddress }: { walletAddress: string | null }) {
  const { getAccessToken, ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { wallet: activeWallet } = useActiveWallet();
  const connected = useMemo(
    () => pickEthereumDestinationWallet(wallets),
    [wallets],
  );
  const fromUser = useMemo(
    () => ethereumAddressFromPrivyUser(user),
    [user],
  );
  const fromActive = useMemo(() => {
    if (!activeWallet) return undefined;
    const w = activeWallet as {
      type?: string;
      chainType?: string;
      address?: string;
    };
    if (!w.address || !isAddress(w.address)) return undefined;
    if (w.type === "ethereum" || w.chainType === "ethereum") return w.address;
    if (w.type === "solana" || w.chainType === "solana") return undefined;
    return w.address;
  }, [activeWallet]);

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
        setGateError(pj.error || "Gagal menghubungkan IDRX");
        setIdrxGate("error");
        return;
      }

      const second = await getStatus();
      if (cancelled) return;
      if (!second.res.ok) {
        setGateError("Status IDRX tidak konsisten setelah onboarding");
        setIdrxGate("error");
        return;
      }
      applyMe(second.j.walletAddress);
      if (second.j.completed) {
        setIdrxGate("ready");
      } else {
        setGateError("Onboarding IDRX belum aktif. Coba muat ulang.");
        setIdrxGate("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

  const dest =
    connected?.address ??
    fromActive ??
    fromUser ??
    meWallet ??
    walletAddress ??
    "";

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
      setError(!dest ? "Dompet belum tersedia" : "Masukkan nominal");
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
      setError(j.error || "Permintaan gagal");
      return;
    }
    setResult({
      paymentUrl: j.paymentUrl,
      amount: j.amount,
      reference: j.reference,
      merchantOrderId: j.merchantOrderId,
    });
  }, [amount, chainId, dest, expiry, getAccessToken]);

  if (idrxGate === "loading" || idrxGate === "linking_idrx") {
    return (
      <Screen
        title="Mint IDRX"
        subtitle={
          idrxGate === "linking_idrx"
            ? "Menghubungkan akun IDRX (email Privy)…"
            : "Memeriksa status IDRX…"
        }
      >
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-arka-border" />
          <p className="text-sm text-arka-text-muted">
            {idrxGate === "linking_idrx"
              ? "Satu saat lagi…"
              : "Menyiapkan mint…"}
          </p>
        </div>
      </Screen>
    );
  }

  if (idrxGate === "error") {
    return (
      <Screen
        title="Mint IDRX"
        subtitle="Tidak bisa menyiapkan IDRX. Coba lagi."
      >
        <Card className="space-y-3 p-4">
          <p className="text-sm text-arka-danger" role="alert">
            {gateError ||
              "Gagal memeriksa atau menghubungkan onboarding. Periksa jaringan lalu muat ulang halaman."}
          </p>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title="Mint IDRX"
      subtitle="Tukar rupiah menjadi IDRX ke dompet Arka kamu. Setelah permintaan
          dibuat, kamu akan diarahkan ke halaman pembayaran mitra."
    >
      <div className="space-y-4">
        <Card className="space-y-3">
          <div>
            <Label>Dompet tujuan (Arka)</Label>
            <p className="mt-1 break-all font-mono text-xs text-arka-text-muted">
              {dest || "Menunggu dompet…"}
            </p>
          </div>
          <div>
            <Label htmlFor="amt">Nominal IDRX (IDR)</Label>
            <Input
              id="amt"
              inputMode="numeric"
              placeholder="Min. Rp 20.000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="mt-1 text-xs text-arka-text-muted">
              Minimum Rp 20.000 sesuai ketentuan IDRX. Nominal bayar bisa sedikit
              berbeda setelah biaya.
            </p>
          </div>
          <div>
            <Label htmlFor="chain">Jaringan</Label>
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
              Base dipilih sebagai default untuk ekspansi produk ke depan.
            </p>
          </div>
          <div>
            <Label>Batas waktu pembayaran</Label>
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
                  {p.label}
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
              Permintaan dibuat. Lanjutkan pembayaran untuk menyelesaikan mint.
            </p>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-arka-text-muted">Total bayar</dt>
                <dd className="font-medium">Rp {result.amount}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-arka-text-muted">Referensi</dt>
                <dd className="max-w-[55%] truncate font-mono text-xs">
                  {result.reference}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-arka-text-muted">Order</dt>
                <dd className="font-mono text-xs">{result.merchantOrderId}</dd>
              </div>
            </dl>
            <a
              href={result.paymentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] bg-arka-accent px-4 text-sm font-medium text-white transition hover:bg-arka-accent-muted active:scale-[0.99]"
            >
              Lanjut ke pembayaran
            </a>
            <p className="text-xs text-arka-text-muted">
              Pantau status di{" "}
              <Link
                href={`/activity?merchantOrderId=${encodeURIComponent(result.merchantOrderId)}`}
                className="font-medium text-arka-accent underline"
              >
                Aktivitas
              </Link>{" "}
              setelah membayar — verifikasi dari API transaksi IDRX.
            </p>
          </Card>
        ) : (
          <Button onClick={submit} disabled={loading}>
            {loading ? "Memproses…" : "Buat permintaan mint"}
          </Button>
        )}
      </div>
    </Screen>
  );
}
