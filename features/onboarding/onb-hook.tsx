"use client";

import { Lockup } from "@/components/brand/logo";
import { useT } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/translations";
import { useEffect, useState } from "react";

type SlideKey = "slide1" | "slide2" | "slide3" | "slide4" | "slide5";
const SLIDES: { key: SlideKey; size: number; letterSpacing: number }[] = [
  { key: "slide1", size: 104, letterSpacing: -2 },
  { key: "slide2", size: 92, letterSpacing: -1.5 },
  { key: "slide3", size: 124, letterSpacing: -1 },
  { key: "slide4", size: 100, letterSpacing: -0.5 },
  { key: "slide5", size: 72, letterSpacing: -1 },
];

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function OnbHook({
  onContinueGoogle,
  onContinueEmail,
  loading,
  errorText,
}: {
  onContinueGoogle: () => void;
  onContinueEmail?: () => void;
  loading?: boolean;
  errorText?: string | null;
}) {
  const t = useT();
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setLoaded(true), 200);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIdx((p) => (p + 1) % SLIDES.length);
        setVisible(true);
      }, 350);
    }, 3200);
    return () => window.clearInterval(id);
  }, []);

  const slide = SLIDES[idx];

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: "var(--arka-gradient-hero)",
          backgroundSize: "300% 300%",
          animation: "grad-move 12s ease infinite",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 200,
          height: 200,
          background: "rgba(255,255,255,0.04)",
          top: "15%",
          right: "-10%",
          animation: "orb-float 8s ease-in-out infinite",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 140,
          height: 140,
          background: "rgba(255,255,255,0.03)",
          bottom: "25%",
          left: "-8%",
          animation: "orb-float 10s ease-in-out infinite reverse",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 80,
          height: 80,
          background: "rgba(255,255,255,0.05)",
          top: "45%",
          right: "20%",
          animation: "orb-float 6s ease-in-out infinite 2s",
        }}
      />

      <div className="relative flex h-full flex-col px-7">
        <div
          className="pt-14 transition-opacity duration-500"
          style={{ opacity: loaded ? 1 : 0 }}
        >
          <Lockup markSize={30} fontSize={24} color="#fff" gap={10} />
        </div>

        <div className="flex flex-1 flex-col justify-center pb-4">
          <div
            className="transition-all duration-[350ms]"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(8px)",
            }}
          >
            <div
              style={{
                fontSize: slide.size,
                fontWeight: 800,
                color: "#fff",
                letterSpacing: slide.letterSpacing,
                lineHeight: 0.92,
              }}
            >
              {t(`onb.${slide.key}.big` as TranslationKey)}
            </div>
            <div
              className="mt-3.5 text-lg font-bold"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {t(`onb.${slide.key}.sub` as TranslationKey)}
            </div>
            <div
              className="mt-1.5 text-sm font-normal"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              {t(`onb.${slide.key}.note` as TranslationKey)}
            </div>
          </div>

          <div className="mt-7 flex gap-1">
            {SLIDES.map((s, i) => (
              <div
                key={s.key}
                className="flex-1 rounded-[2px] transition-colors duration-300"
                style={{
                  height: 2.5,
                  background:
                    i === idx
                      ? "rgba(255,255,255,0.65)"
                      : "rgba(255,255,255,0.12)",
                }}
              />
            ))}
          </div>
        </div>

        <div
          className="transition-all duration-[800ms]"
          style={{
            transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
            transitionDelay: "0.4s",
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(12px)",
          }}
        >
          <div
            className="text-[28px] font-extrabold leading-[1.15]"
            style={{ color: "#fff", letterSpacing: -1 }}
          >
            {t("onb.headline")}
          </div>
          <div
            className="mt-2 text-sm font-normal leading-relaxed"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            {t("onb.sub")}
          </div>
        </div>

        <div
          className="pb-8 pt-5 transition-opacity duration-500"
          style={{ transitionDelay: "0.8s", opacity: loaded ? 1 : 0 }}
        >
          <button
            type="button"
            onClick={onContinueGoogle}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-4"
            style={{
              background: "rgba(255,255,255,0.95)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            }}
          >
            <GoogleIcon />
            <span
              className="text-sm font-bold"
              style={{ color: "#1a1a1a" }}
            >
              {loading ? t("auth.connecting") : t("auth.continueGoogle")}
            </span>
          </button>

          {onContinueEmail ? (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={onContinueEmail}
                className="border-b pb-0.5 text-xs font-semibold"
                style={{
                  color: "rgba(255,255,255,0.5)",
                  borderColor: "rgba(255,255,255,0.15)",
                }}
              >
                {t("onb.orEmail")}
              </button>
            </div>
          ) : null}

          {errorText ? (
            <p
              className="mt-3 text-center text-xs"
              style={{ color: "rgba(255,230,230,0.9)" }}
              role="alert"
            >
              {errorText}
            </p>
          ) : null}

          <div
            className="mt-3.5 text-center text-[10px]"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            {t("onb.terms")}
          </div>
        </div>
      </div>
    </div>
  );
}
