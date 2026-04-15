"use client";

import { Button } from "@/components/ui/button";
import { usePostLoginSync } from "@/hooks/use-post-login-sync";
import { useLocale, useT } from "@/lib/i18n";
import { fetchWithPrivy } from "@/lib/api";
import { useLoginWithOAuth, usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

function FeaturePill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-arka-border bg-arka-surface px-3.5 py-1.5 text-xs font-medium text-arka-text shadow-sm">
      {children}
    </span>
  );
}

function LangToggle() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="inline-flex rounded-full border border-arka-border bg-arka-surface p-0.5 text-xs font-medium">
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded-full px-3 py-1 transition ${locale === "en" ? "bg-arka-accent text-white shadow-sm" : "text-arka-text-muted hover:text-arka-text"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("id")}
        className={`rounded-full px-3 py-1 transition ${locale === "id" ? "bg-arka-accent text-white shadow-sm" : "text-arka-text-muted hover:text-arka-text"}`}
      >
        ID
      </button>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto flex h-48 w-48 items-center justify-center">
      <div className="animate-pulse-ring absolute inset-0 rounded-full bg-arka-accent/10" />
      <div className="absolute inset-4 rounded-full bg-arka-accent/5" />

      <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-arka-accent shadow-lg">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <path
            d="M20 4C11.16 4 4 11.16 4 20s7.16 16 16 16 16-7.16 16-16S28.84 4 20 4zm1.5 25.5h-3v-3h3v3zm0-5.5h-3V10h3v14z"
            fill="white"
            opacity="0.15"
          />
          <text x="11" y="27" fill="white" fontSize="20" fontWeight="700" fontFamily="system-ui">
            ₿
          </text>
        </svg>
      </div>

      <div className="animate-float absolute -top-2 right-4 flex h-10 w-10 items-center justify-center rounded-xl bg-arka-surface shadow-md border border-arka-border">
        <span className="text-sm">🏠</span>
      </div>
      <div className="animate-float-slow absolute -bottom-1 left-2 flex h-10 w-10 items-center justify-center rounded-xl bg-arka-surface shadow-md border border-arka-border">
        <span className="text-sm">🛡️</span>
      </div>
      <div className="animate-float absolute -right-2 bottom-6 flex h-10 w-10 items-center justify-center rounded-xl bg-arka-surface shadow-md border border-arka-border" style={{ animationDelay: "1s" }}>
        <span className="text-sm">🏡</span>
      </div>
      <div className="animate-float-slow absolute left-0 top-6 flex h-8 w-8 items-center justify-center rounded-lg bg-arka-surface shadow border border-arka-border" style={{ animationDelay: "0.5s" }}>
        <span className="text-xs">🪙</span>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.26c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export function AuthScreen() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { initOAuth, state } = useLoginWithOAuth();
  const router = useRouter();
  const sync = usePostLoginSync();
  const t = useT();
  const [meChecked, setMeChecked] = useState(false);

  const getAccessTokenRef = useRef(getAccessToken);
  const syncRef = useRef(sync);
  useLayoutEffect(() => {
    getAccessTokenRef.current = getAccessToken;
    syncRef.current = sync;
  }, [getAccessToken, sync]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      startTransition(() => setMeChecked(false));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await syncRef.current();
        await fetchWithPrivy(getAccessTokenRef.current, "/api/user/me");
        if (cancelled) return;
        setMeChecked(true);
        router.replace("/home");
      } catch (e) {
        console.error("Post-login setup failed:", e);
        if (cancelled) return;
        setMeChecked(true);
        router.replace("/home");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, router]);

  if (!ready) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6">
        <div className="h-8 w-8 animate-pulse rounded-full bg-arka-border" />
        <p className="mt-4 text-sm text-arka-text-muted">{t("auth.loading")}</p>
      </div>
    );
  }

  if (authenticated && !meChecked && ready) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6">
        <div className="h-8 w-8 animate-pulse rounded-full bg-arka-border" />
        <p className="mt-4 text-sm text-arka-text-muted">{t("auth.settingUp")}</p>
      </div>
    );
  }

  if (authenticated) {
    return null;
  }

  const oauthStatus = state.status;
  const err = oauthStatus === "error" ? t("auth.loginFailed") : null;

  return (
    <div className="flex min-h-dvh flex-col justify-between px-6 py-8">
      <div className="mx-auto w-full max-w-md flex-1 space-y-6">
        {/* Header with logo and language toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-arka-accent text-base font-bold text-white shadow-sm">
              A
            </div>
            <span className="text-base font-bold tracking-tight text-arka-text">
              ARKA
            </span>
          </div>
          <LangToggle />
        </div>

        {/* Hero visual */}
        <div className="pt-4 pb-2">
          <HeroVisual />
        </div>

        {/* Headline */}
        <div className="text-center">
          <h1 className="text-3xl font-bold leading-tight text-arka-text">
            {t("auth.tagline")}{" "}
            <span className="text-arka-accent">{t("auth.taglineHighlight")}</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-arka-text-muted">
            {t("auth.subtitle")}
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2">
          <FeaturePill>
            <span aria-hidden>🎯</span> {t("auth.pill.savings")}
          </FeaturePill>
          <FeaturePill>
            <span aria-hidden>📈</span> {t("auth.pill.dca")}
          </FeaturePill>
          <FeaturePill>
            <span aria-hidden>💰</span> {t("auth.pill.directIdr")}
          </FeaturePill>
        </div>

        {/* Auth button */}
        <div className="pt-4">
          <Button
            variant="secondary"
            disabled={oauthStatus === "loading"}
            className="gap-2.5 border-arka-border shadow-sm"
            onClick={() => initOAuth({ provider: "google" })}
          >
            <GoogleIcon />
            {oauthStatus === "loading" ? t("auth.connecting") : t("auth.continueGoogle")}
          </Button>
        </div>

        {err && (
          <p className="text-center text-sm text-arka-danger">{err}</p>
        )}
      </div>

      {/* Footer */}
      <p className="mx-auto mt-8 max-w-sm text-center text-[11px] leading-relaxed text-arka-text-muted">
        {t("auth.riskDisclaimer")}{" "}
        <a href="#" className="font-medium text-arka-accent hover:underline">
          {t("auth.termsOfService")}
        </a>{" "}
        {t("auth.and")}{" "}
        <a href="#" className="font-medium text-arka-accent hover:underline">
          {t("auth.privacyPolicy")}
        </a>
        .
      </p>
    </div>
  );
}
