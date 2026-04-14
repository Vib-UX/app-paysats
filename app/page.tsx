"use client";

import { fetchWithPrivy } from "@/lib/api";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

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
      router.replace("/auth");
      startTransition(() => setRouting(false));
      return;
    }
    if (routeStarted.current) return;
    routeStarted.current = true;
    let cancelled = false;
    (async () => {
      await fetchWithPrivy(getAccessTokenRef.current, "/api/user/me");
      if (cancelled) {
        routeStarted.current = false;
        return;
      }
      setRouting(false);
      router.replace("/home");
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, router]);

  if (!ready || routing) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-6">
        <div className="h-8 w-8 animate-pulse rounded-full bg-arka-border" />
        <p className="mt-4 text-sm text-arka-text-muted">Memuat…</p>
      </div>
    );
  }

  return null;
}
