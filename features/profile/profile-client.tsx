"use client";

import { Card } from "@/components/ui/card";
import { PillSeg } from "@/components/ui/pill-seg";
import { fetchWithPrivy } from "@/lib/api";
import { useCurrency } from "@/lib/currency";
import { useDisplayUnit, type DisplayUnit } from "@/lib/display-unit";
import { useLocale, useT, type Locale } from "@/lib/i18n";
import { resolveWalletDisplayAddress } from "@/lib/privy-destination-wallet";
import {
  useActiveWallet,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type MePayload = {
  email: string | null;
  displayName: string | null;
  walletAddress: string | null;
  onboardingCompleted: boolean;
};

const APP_VERSION = "0.1.0";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div
        className="px-1 text-[11px] font-bold uppercase tracking-[0.08em]"
        style={{ color: "var(--arka-text-muted)" }}
      >
        {title}
      </div>
      <Card className="divide-y divide-[color:var(--arka-border)]">
        {children}
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  onClick,
  href,
  tone,
}: {
  label: string;
  value?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: "default" | "danger";
}) {
  const color =
    tone === "danger" ? "var(--arka-danger)" : "var(--arka-text)";
  const content = (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-[13px] font-semibold" style={{ color }}>
        {label}
      </span>
      {value !== undefined ? (
        <span
          className="max-w-[55%] truncate text-right text-[12px]"
          style={{ color: "var(--arka-text-muted)" }}
        >
          {value}
        </span>
      ) : onClick || href ? (
        <span
          className="text-[14px]"
          style={{ color: "var(--arka-text-faint)" }}
        >
          ›
        </span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <a href={href} data-pressable className="block">
        {content}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} data-pressable className="block w-full text-left">
        {content}
      </button>
    );
  }
  return <div>{content}</div>;
}

export function ProfileClient() {
  const { logout, getAccessToken, ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { wallet: activeWallet } = useActiveWallet();
  const router = useRouter();
  const t = useT();
  const { locale, setLocale } = useLocale();
  const { currency, setCurrency } = useCurrency();
  const { unit: displayUnit, setUnit: setDisplayUnit } = useDisplayUnit();
  const [me, setMe] = useState<MePayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await fetchWithPrivy(getAccessToken, "/api/user/me");
    const j = (await res.json().catch(() => ({}))) as Partial<MePayload>;
    if (!res.ok) {
      setLoadError(t("profile.loadError"));
      return;
    }
    setMe({
      email: j.email ?? null,
      displayName: j.displayName ?? null,
      walletAddress: j.walletAddress ?? null,
      onboardingCompleted: Boolean(j.onboardingCompleted),
    });
  }, [getAccessToken, t]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [ready, authenticated, load]);

  const walletDisplay = useMemo(() => {
    if (!me) return undefined;
    return resolveWalletDisplayAddress({
      wallets,
      user,
      activeWallet,
      dbWallet: me.walletAddress,
    });
  }, [me, wallets, user, activeWallet]);

  const updateCurrency = useCallback(
    async (c: "IDR" | "USD") => {
      setCurrency(c);
      try {
        await fetchWithPrivy(getAccessToken, "/api/user/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currencyPreference: c }),
        });
      } catch {
        /* non-blocking */
      }
    },
    [getAccessToken, setCurrency],
  );

  const updateDisplayUnit = useCallback(
    async (u: DisplayUnit) => {
      setDisplayUnit(u);
      try {
        await fetchWithPrivy(getAccessToken, "/api/user/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayUnit: u }),
        });
      } catch {
        /* non-blocking */
      }
    },
    [getAccessToken, setDisplayUnit],
  );

  const onLogout = useCallback(async () => {
    await logout();
    router.replace("/onboarding");
    router.refresh();
  }, [logout, router]);

  const copyWallet = useCallback(async () => {
    if (!walletDisplay) return;
    try {
      await navigator.clipboard.writeText(walletDisplay);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [walletDisplay]);

  if (!ready || !authenticated || !me) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-pulse rounded-full bg-arka-border" />
      </div>
    );
  }

  const short = walletDisplay
    ? `${walletDisplay.slice(0, 6)}…${walletDisplay.slice(-4)}`
    : "—";

  return (
    <div className="px-5 pb-14">
      <div className="flex items-center gap-3 pt-12">
        <a
          href="/home"
          aria-label="Back"
          data-pressable
          className="flex h-10 w-10 items-center justify-center rounded-[12px]"
          style={{
            background: "var(--arka-surface)",
            boxShadow: "var(--arka-shadow-card)",
            color: "var(--arka-text)",
          }}
        >
          ←
        </a>
        <div
          className="text-lg font-extrabold"
          style={{ color: "var(--arka-text)", letterSpacing: -0.4 }}
        >
          {t("settings.title")}
        </div>
      </div>

      {loadError ? (
        <p
          className="mt-4 text-sm"
          style={{ color: "var(--arka-danger)" }}
          role="alert"
        >
          {loadError}
        </p>
      ) : null}

      <div className="mt-5 space-y-5">
        <Section title={t("settings.account")}>
          <Row label={t("profile.name")} value={me.displayName || "—"} />
          <Row label={t("profile.email")} value={me.email || "—"} />
        </Section>

        <Section title={t("settings.preferences")}>
          <div className="py-3">
            <div
              className="mb-2 text-[12px] font-semibold"
              style={{ color: "var(--arka-text)" }}
            >
              {t("settings.currency")}
            </div>
            <PillSeg<"IDR" | "USD">
              value={currency}
              onChange={updateCurrency}
              options={[
                { value: "IDR", label: "IDR (Rp)" },
                { value: "USD", label: "USD ($)" },
              ]}
            />
          </div>
          <div className="py-3">
            <div
              className="mb-2 text-[12px] font-semibold"
              style={{ color: "var(--arka-text)" }}
            >
              {t("settings.display")}
            </div>
            <PillSeg<DisplayUnit>
              value={displayUnit}
              onChange={updateDisplayUnit}
              options={[
                { value: "SATS", label: "Sats" },
                { value: "BTC", label: "BTC" },
              ]}
            />
          </div>
          <div className="py-3">
            <div
              className="mb-2 text-[12px] font-semibold"
              style={{ color: "var(--arka-text)" }}
            >
              {t("settings.language")}
            </div>
            <PillSeg<Locale>
              value={locale}
              onChange={setLocale}
              options={[
                { value: "id", label: "Bahasa" },
                { value: "en", label: "English" },
              ]}
            />
          </div>
        </Section>

        <Section title={t("settings.wallet")}>
          <Row label={t("profile.wallet")} value={short} />
          <Row
            label={copied ? t("settings.copied") : t("settings.copyAddress")}
            onClick={copyWallet}
          />
          {walletDisplay ? (
            <Row
              label={t("settings.viewOnBasescan")}
              href={`https://basescan.org/address/${walletDisplay}`}
            />
          ) : null}
        </Section>

        <Section title={t("settings.linkedAccounts")}>
          <Row label={t("settings.payoutDestinations")} href="/withdraw" />
        </Section>

        <Section title={t("settings.helpSupport")}>
          <Row
            label={t("settings.contactTelegram")}
            href="https://t.me/+C2O7jGRN7xo3MWMx"
          />
          <Row
            label={t("settings.contactEmail")}
            href="mailto:hi@arka.finance"
          />
        </Section>

        <Section title={t("settings.about")}>
          <Row label={t("settings.terms")} href="/terms" />
          <Row label={t("settings.privacy")} href="/privacy" />
          <Row label={t("settings.version")} value={APP_VERSION} />
        </Section>

        <Section title="">
          <Row label={t("profile.logout")} tone="danger" onClick={onLogout} />
        </Section>
      </div>
    </div>
  );
}
