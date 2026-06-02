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
        style={{ color: "var(--paysats-text-muted)" }}
      >
        {title}
      </div>
      <Card className="divide-y divide-[color:var(--paysats-border)]">
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
  leading,
  trailing,
  external,
}: {
  label: string;
  value?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: "default" | "danger";
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  external?: boolean;
}) {
  const color =
    tone === "danger" ? "var(--paysats-danger)" : "var(--paysats-text)";
  const content = (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="flex min-w-0 items-center gap-2.5">
        {leading}
        <span className="text-[13px] font-semibold" style={{ color }}>
          {label}
        </span>
      </span>
      {trailing !== undefined ? (
        <span className="flex items-center gap-1.5 text-right">
          {trailing}
        </span>
      ) : value !== undefined ? (
        <span
          className="max-w-[55%] truncate text-right text-[12px]"
          style={{ color: "var(--paysats-text-muted)" }}
        >
          {value}
        </span>
      ) : onClick || href ? (
        <span
          className="text-[14px]"
          style={{ color: "var(--paysats-text-faint)" }}
        >
          {external ? "↗" : "›"}
        </span>
      ) : null}
    </div>
  );

  if (href) {
    const externalLinkProps = external
      ? { target: "_blank", rel: "noreferrer" as const }
      : {};
    return (
      <a href={href} data-pressable className="block" {...externalLinkProps}>
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

// ---------- Inline SVG icons ----------

function TelegramIcon() {
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
      style={{ background: "rgba(51,144,236,0.14)", color: "#3390ec" }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M21.5 3.5 2.9 10.7c-1 .4-1 1.7 0 2.1l4.7 1.6 1.8 5.8c.2.7 1.1.9 1.6.4l2.7-2.6 4.9 3.6c.8.6 1.9.1 2-.9l3.1-15.6c.2-1.1-.9-2-2.2-1.6Z"
          fill="currentColor"
        />
        <path
          d="m8.1 14.4 8.7-6.6c.2-.2.5.1.3.3l-7.3 6.9-.3 3-1.4-3.6Z"
          fill="#fff"
        />
      </svg>
    </span>
  );
}

function EmailIcon() {
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
      style={{ background: "var(--paysats-accent-soft)", color: "var(--paysats-accent)" }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="2.5"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="m4 7 7.3 5.2a1.2 1.2 0 0 0 1.4 0L20 7"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M15 9V6.2A2.2 2.2 0 0 0 12.8 4H6.2A2.2 2.2 0 0 0 4 6.2v6.6A2.2 2.2 0 0 0 6.2 15H9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
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
        <div className="h-8 w-8 animate-pulse rounded-full bg-paysats-border" />
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
            background: "var(--paysats-surface)",
            boxShadow: "var(--paysats-shadow-card)",
            color: "var(--paysats-text)",
          }}
        >
          ←
        </a>
        <div
          className="text-lg font-extrabold"
          style={{ color: "var(--paysats-text)", letterSpacing: -0.4 }}
        >
          {t("settings.title")}
        </div>
      </div>

      {loadError ? (
        <p
          className="mt-4 text-sm"
          style={{ color: "var(--paysats-danger)" }}
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
          <div className="flex items-center justify-between gap-3 py-3">
            <span
              className="text-[13px] font-semibold"
              style={{ color: "var(--paysats-text)" }}
            >
              {t("settings.currency")}
            </span>
            <div className="w-[160px] shrink-0">
              <PillSeg<"IDR" | "USD">
                value={currency}
                onChange={updateCurrency}
                options={[
                  { value: "IDR", label: "IDR" },
                  { value: "USD", label: "USD" },
                ]}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 py-3">
            <span
              className="text-[13px] font-semibold"
              style={{ color: "var(--paysats-text)" }}
            >
              {t("settings.display")}
            </span>
            <div className="w-[160px] shrink-0">
              <PillSeg<DisplayUnit>
                value={displayUnit}
                onChange={updateDisplayUnit}
                options={[
                  { value: "SATS", label: "Sats" },
                  { value: "BTC", label: "BTC" },
                ]}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 py-3">
            <span
              className="text-[13px] font-semibold"
              style={{ color: "var(--paysats-text)" }}
            >
              {t("settings.language")}
            </span>
            <div className="w-[120px] shrink-0">
              <PillSeg<Locale>
                value={locale}
                onChange={setLocale}
                options={[
                  { value: "id", label: "ID" },
                  { value: "en", label: "EN" },
                ]}
              />
            </div>
          </div>
        </Section>

        <Section title={t("settings.wallet")}>
          <Row
            label={t("profile.wallet")}
            trailing={
              <>
                <span
                  className="max-w-[45%] truncate text-[12px] tabular-nums"
                  style={{ color: "var(--paysats-text-muted)" }}
                >
                  {short}
                </span>
                {walletDisplay ? (
                  <button
                    type="button"
                    onClick={copyWallet}
                    aria-label={t("settings.copyAddress")}
                    data-pressable
                    className="flex h-7 w-7 items-center justify-center rounded-[8px]"
                    style={{
                      background: copied
                        ? "var(--paysats-accent-soft)"
                        : "var(--paysats-surface-muted)",
                      color: copied
                        ? "var(--paysats-accent)"
                        : "var(--paysats-text-muted)",
                    }}
                    title={copied ? t("settings.copied") : t("settings.copyAddress")}
                  >
                    {copied ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden
                      >
                        <path
                          d="m5 12 4.5 4.5L19 7"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <CopyIcon />
                    )}
                  </button>
                ) : null}
              </>
            }
          />
          {walletDisplay ? (
            <Row
              label={t("settings.viewOnBasescan")}
              href={`https://basescan.org/address/${walletDisplay}`}
              external
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
            leading={<TelegramIcon />}
            external
          />
          <Row
            label={t("settings.contactEmail")}
            href="mailto:support@paysats.exchange"
            leading={<EmailIcon />}
            external
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
