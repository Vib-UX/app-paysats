"use client";

import { usePostLoginSync } from "@/hooks/use-post-login-sync";
import {
  useCreateWallet,
  useLoginWithOAuth,
  usePrivy,
  useSigners,
  type User,
} from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { isAddress } from "viem";

const SIGNER_ID = process.env.NEXT_PUBLIC_PRIVY_AGENT_SIGNER_ID;
const POLICY_ID = process.env.NEXT_PUBLIC_PRIVY_AGENT_POLICY_ID;

type Phase = "init" | "login" | "ready" | "working" | "done" | "error";

function embeddedEthereumAddress(user: User | null): string | undefined {
  if (!user) return undefined;
  for (const a of user.linkedAccounts ?? []) {
    if (
      a.type === "wallet" &&
      "walletClientType" in a &&
      (a as { walletClientType?: string }).walletClientType === "privy" &&
      (a as { chainType?: string }).chainType === "ethereum" &&
      "address" in a &&
      isAddress((a as { address: string }).address)
    ) {
      return (a as { address: string }).address;
    }
  }
  const w = user.wallet;
  if (w?.chainType === "ethereum" && w.address && isAddress(w.address)) {
    return w.address;
  }
  return undefined;
}

export function ConnectClient({ handle }: { handle: string | null }) {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const { initOAuth } = useLoginWithOAuth();
  const { createWallet } = useCreateWallet();
  const { addSigners } = useSigners();
  const sync = usePostLoginSync();

  const [phase, setPhase] = useState<Phase>("init");
  const [message, setMessage] = useState<string>("");
  const started = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (!handle) {
      setPhase("error");
      setMessage("Tautan tidak valid atau kedaluwarsa. Mulai ulang dari Claude.");
      return;
    }
    setPhase(authenticated ? "ready" : "login");
  }, [ready, authenticated, handle]);

  const onLogin = useCallback(async () => {
    try {
      await initOAuth({ provider: "google" });
    } catch {
      setPhase("error");
      setMessage("Login gagal. Coba lagi.");
    }
  }, [initOAuth]);

  const onAuthorize = useCallback(async () => {
    if (!handle) return;
    setPhase("working");
    try {
      // Ensure embedded wallet (smart wallet is auto-created on login).
      await sync().catch(() => undefined);

      const addr = embeddedEthereumAddress(user);
      if (!addr) {
        setMessage("Membuat dompet…");
        try {
          await createWallet();
        } catch {
          // ignore — may already exist
        }
      }

      // Grant the agent session signer (if configured server-side).
      const grantAddr = embeddedEthereumAddress(user) ?? addr;
      if (SIGNER_ID && grantAddr) {
        setMessage("Memberi izin agent…");
        try {
          await addSigners({
            address: grantAddr,
            signers: [
              {
                signerId: SIGNER_ID,
                ...(POLICY_ID ? { policyIds: [POLICY_ID] } : {}),
              },
            ],
          });
        } catch (e) {
          setPhase("error");
          setMessage(
            e instanceof Error ? e.message : "Gagal memberi izin agent.",
          );
          return;
        }
      }

      setMessage("Menyelesaikan…");
      const token = await getAccessToken();
      if (!token) throw new Error("Sesi tidak ditemukan");

      const res = await fetch("/api/oauth/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, privyAccessToken: token }),
      });
      const json = (await res.json()) as { redirectUrl?: string; error?: string };
      if (!res.ok || !json.redirectUrl) {
        throw new Error(json.error || "Gagal menyelesaikan koneksi");
      }
      setPhase("done");
      window.location.href = json.redirectUrl;
    } catch (e) {
      setPhase("error");
      setMessage(e instanceof Error ? e.message : "Terjadi kesalahan.");
    }
  }, [handle, user, sync, createWallet, addSigners, getAccessToken]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#faf7f4",
        color: "#2b2017",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 16,
          padding: 28,
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          Hubungkan PaySats ke Claude
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: "#6b5c4d", marginBottom: 20 }}>
          Masuk dengan Google dan beri izin agent untuk mengelola DCA atas nama
          Anda. Cukup sekali — setelah itu Claude bisa langsung membantu deposit
          dan DCA tanpa membuka browser lagi.
        </p>

        {phase === "init" ? <p>Memuat…</p> : null}

        {phase === "login" ? (
          <button onClick={onLogin} style={primaryBtn}>
            Masuk dengan Google
          </button>
        ) : null}

        {phase === "ready" ? (
          <button onClick={onAuthorize} style={primaryBtn}>
            Izinkan agent & lanjut
          </button>
        ) : null}

        {phase === "working" ? <p>{message || "Memproses…"}</p> : null}

        {phase === "done" ? <p>Berhasil! Mengarahkan kembali ke Claude…</p> : null}

        {phase === "error" ? (
          <p style={{ color: "#b3261e" }}>{message}</p>
        ) : null}
      </div>
    </main>
  );
}

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 12,
  border: "none",
  background: "#b85c38",
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
