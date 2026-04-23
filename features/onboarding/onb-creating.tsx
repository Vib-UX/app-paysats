"use client";

import { LogoMark } from "@/components/brand/logo";
import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";

/**
 * Mounted while post-login setup resolves (Privy wallet + /api/user/sync +
 * /api/idrx/onboarding). The mark assembles once then breathes. When the
 * `ready` flag flips true (with a minimum dwell) we show the heartbeat
 * confirmation and fire `onDone`.
 */
export function OnbCreating({
  ready,
  onDone,
  minDuration = 2000,
}: {
  ready: boolean;
  onDone: () => void;
  minDuration?: number;
}) {
  const t = useT();
  const [phase, setPhase] = useState<"loading" | "success">("loading");
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!ready) return;
    const elapsed = Date.now() - mountedAt;
    const remaining = Math.max(0, minDuration - elapsed);
    const t1 = window.setTimeout(() => setPhase("success"), remaining);
    const t2 = window.setTimeout(onDone, remaining + 700);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [ready, minDuration, mountedAt, onDone]);

  const tileAnim =
    phase === "success"
      ? "tile-confirm 0.6s cubic-bezier(0.34,1.56,0.64,1)"
      : "none";

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center px-7"
      style={{ background: "var(--arka-bg)" }}
    >
      <div
        className="relative flex items-center justify-center"
        style={{
          width: 96,
          height: 96,
          borderRadius: 24,
          background: "var(--arka-gradient)",
          boxShadow: "0 12px 40px rgba(170,80,40,0.28)",
          marginBottom: 36,
          animation: tileAnim,
        }}
      >
        {/* Building / breathing mark — visible while loading */}
        <div
          className="relative transition-opacity"
          style={{
            width: 56,
            height: 56,
            opacity: phase === "loading" ? 1 : 0,
          }}
        >
          <span
            className="absolute"
            style={{
              left: "15%",
              top: "18%",
              width: "17%",
              height: "64%",
              borderRadius: 4,
              background: "#fff",
              opacity: 0,
              animation:
                "bar-rise 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s forwards, mark-bar-breathe 2s ease-in-out 1.4s infinite",
            }}
          />
          <span
            className="absolute"
            style={{
              right: "15%",
              top: "18%",
              width: "17%",
              height: "64%",
              borderRadius: 4,
              background: "#fff",
              opacity: 0,
              animation:
                "bar-rise 0.5s cubic-bezier(0.16,1,0.3,1) 0.35s forwards, mark-bar-breathe 2s ease-in-out 1.5s infinite",
            }}
          />
          <span
            className="absolute"
            style={{
              left: "41%",
              top: "41%",
              width: "18%",
              height: "18%",
              borderRadius: "50%",
              background: "#fff",
              opacity: 0,
              animation:
                "dot-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.75s forwards, mark-dot-breathe 2.4s ease-in-out 1.6s infinite",
            }}
          />
        </div>

        <div
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
          style={{ opacity: phase === "success" ? 1 : 0 }}
        >
          <LogoMark size={56} color="#fff" />
        </div>
      </div>

      <div
        className="mb-2.5 text-center text-2xl font-extrabold transition-opacity duration-300"
        style={{ color: "var(--arka-text)", letterSpacing: -0.6 }}
      >
        {phase === "loading"
          ? t("onb.creating.title")
          : t("onb.creating.doneTitle")}
      </div>
      <div
        className="text-center text-sm transition-opacity duration-300"
        style={{ color: "var(--arka-text-faint)", minHeight: 22 }}
      >
        {phase === "loading"
          ? t("onb.creating.sub")
          : t("onb.creating.doneSub")}
      </div>
    </div>
  );
}
