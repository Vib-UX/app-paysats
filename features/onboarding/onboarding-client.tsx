"use client";

import { fetchWithPrivy } from "@/lib/api";
import { useCurrency, type CurrencyCode } from "@/lib/currency";
import { isLocale, useLocale, useT, type Locale } from "@/lib/i18n";
import { usePostLoginSync } from "@/hooks/use-post-login-sync";
import { useLogin, useLoginWithOAuth, usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { OnbCreating } from "./onb-creating";
import { OnbCurrency } from "./onb-currency";
import { OnbHook } from "./onb-hook";
import { OnbLanguage } from "./onb-language";
import { OnbStacksFund } from "./onb-stacks-fund";
import { Splash } from "./splash";

type Step =
  | "splash"
  | "hook"
  | "creating"
  | "language"
  | "currency"
  | "stacksFund";

/**
 * Full onboarding flow:
 *   splash → hook → creating → language → currency → stacksFund → /home
 *   (stacksFund can skip straight to /home; "Show guide" → /mint?stacks=1)
 */
export function OnboardingClient() {
  const router = useRouter();
  const t = useT();
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { initOAuth, state } = useLoginWithOAuth();
  const sync = usePostLoginSync();
  const { setCurrency } = useCurrency();
  const { setLocale } = useLocale();

  const [step, setStep] = useState<Step>("splash");
  const [fade, setFade] = useState(true);
  const [syncDone, setSyncDone] = useState(false);
  const [needsOnboardingPrefs, setNeedsOnboardingPrefs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingLocale, setPendingLocale] = useState<Locale>("en");

  const tokenRef = useRef(getAccessToken);
  const syncRef = useRef(sync);
  useLayoutEffect(() => {
    tokenRef.current = getAccessToken;
    syncRef.current = sync;
  }, [getAccessToken, sync]);

  const go = useCallback((next: Step) => {
    setFade(false);
    window.setTimeout(() => {
      setStep(next);
      setFade(true);
    }, 200);
  }, []);

  const goRef = useRef(go);
  useLayoutEffect(() => {
    goRef.current = go;
  }, [go]);

  const { login } = useLogin({
    onComplete: () => {
      goRef.current("creating");
    },
    onError: () => {
      setError(t("auth.loginFailed"));
    },
  });

  useEffect(() => {
    if (step !== "splash") return;
    if (!ready) return;
    const timer = window.setTimeout(() => {
      if (authenticated) {
        go("creating");
      } else {
        go("hook");
      }
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [ready, authenticated, step, go]);

  useEffect(() => {
    if (step === "hook" && authenticated) {
      go("creating");
    }
  }, [step, authenticated, go]);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    (async () => {
      try {
        await syncRef.current();
        const res = await fetchWithPrivy(
          tokenRef.current,
          "/api/user/me",
        );
        const j = (await res.json().catch(() => ({}))) as {
          currencyPreference?: string | null;
          localePreference?: string | null;
          onboardingCompleted?: boolean;
        };
        if (cancelled) return;
        if (isLocale(j.localePreference)) {
          setLocale(j.localePreference);
        }
        setNeedsOnboardingPrefs(
          !j.currencyPreference || !j.onboardingCompleted,
        );
        setSyncDone(true);
      } catch (e) {
        console.error("Post-login setup failed:", e);
        if (cancelled) return;
        setSyncDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, setLocale]);

  const oauthLoading = state.status === "loading";
  const oauthError =
    state.status === "error" ? t("auth.loginFailed") : null;

  const onContinueGoogle = useCallback(async () => {
    setError(null);
    try {
      await initOAuth({ provider: "google" });
      go("creating");
    } catch (e) {
      console.error(e);
      setError(t("auth.loginFailed"));
    }
  }, [initOAuth, go, t]);

  const onContinueEmail = useCallback(() => {
    setError(null);
    login({ loginMethods: ["email"] });
  }, [login]);

  const onCreatingDone = useCallback(() => {
    if (needsOnboardingPrefs) {
      go("language");
    } else {
      router.replace("/home");
    }
  }, [needsOnboardingPrefs, go, router]);

  const onLanguageContinue = useCallback(
    (l: Locale) => {
      setLocale(l);
      setPendingLocale(l);
      go("currency");
    },
    [setLocale, go],
  );

  const onCurrencyContinue = useCallback(
    async (c: CurrencyCode) => {
      setBusy(true);
      setCurrency(c);
      try {
        await fetchWithPrivy(tokenRef.current, "/api/user/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currencyPreference: c,
            localePreference: pendingLocale,
            completeOnboarding: true,
          }),
        });
      } catch (e) {
        console.error("Failed to persist preferences:", e);
      }
      setBusy(false);
      go("stacksFund");
    },
    [setCurrency, pendingLocale, go],
  );

  const finishHome = useCallback(() => {
    router.replace("/home");
  }, [router]);

  const finishStacksGuide = useCallback(() => {
    router.replace("/mint?stacks=1");
  }, [router]);

  return (
    <div
      className="absolute inset-0 transition-opacity duration-200"
      style={{ opacity: fade ? 1 : 0 }}
    >
      {step === "splash" ? <Splash /> : null}
      {step === "hook" ? (
        <OnbHook
          onContinueGoogle={onContinueGoogle}
          onContinueEmail={onContinueEmail}
          loading={oauthLoading}
          errorText={error ?? oauthError}
        />
      ) : null}
      {step === "creating" ? (
        <OnbCreating ready={syncDone} onDone={onCreatingDone} />
      ) : null}
      {step === "language" ? (
        <OnbLanguage onContinue={onLanguageContinue} busy={busy} />
      ) : null}
      {step === "currency" ? (
        <OnbCurrency onContinue={onCurrencyContinue} busy={busy} />
      ) : null}
      {step === "stacksFund" ? (
        <OnbStacksFund
          onContinue={finishStacksGuide}
          onSkip={finishHome}
          busy={busy}
        />
      ) : null}
    </div>
  );
}
