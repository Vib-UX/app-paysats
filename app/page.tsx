"use client";

import { fetchWithPrivy } from "@/lib/api";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Splash } from "@/features/onboarding/splash";

/**
 * Entry point. Renders the splash while we decide where to land.
 *   - not authenticated → /onboarding (plays the hook → google → creating flow)
 *   - authenticated but onboarding incomplete or no currencyPreference → /onboarding
 *   - otherwise → /home
 */
export default function HomePage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();
  const [routing, setRouting] = useState(true);
  const routeStarted = useRef(false);

  const getAccessTokenRef = useRef(getAccessToken);
  useLayoutEffect(() => {
    getAccessTokenRef.current = getAccessToken;
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      routeStarted.current = false;
      router.replace("/onboarding");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRouting(false);
      return;
    }
    if (routeStarted.current) return;
    routeStarted.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithPrivy(
          getAccessTokenRef.current,
          "/api/user/me",
        );
        const j = (await res.json().catch(() => ({}))) as {
          onboardingCompleted?: boolean;
          currencyPreference?: string | null;
        };
        if (cancelled) return;
        const needsOnboarding =
          !j.onboardingCompleted || !j.currencyPreference;
        setRouting(false);
        router.replace(needsOnboarding ? "/onboarding" : "/home");
      } catch {
        if (cancelled) return;
        setRouting(false);
        router.replace("/home");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, router]);

  if (!ready || routing) {
    return (
      <div className="relative min-h-dvh w-full overflow-hidden">
        <Splash />
      </div>
    );
  }

  return null;
}
