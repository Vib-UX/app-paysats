"use client";

import dynamic from "next/dynamic";

function OnboardingLoading() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: "var(--paysats-bg)" }}
      suppressHydrationWarning
    >
      <div
        className="h-8 w-8 animate-pulse rounded-full bg-paysats-border"
        suppressHydrationWarning
      />
    </div>
  );
}

const OnboardingLazy = dynamic(
  () =>
    import("@/features/onboarding/onboarding-client").then((m) => ({
      default: m.OnboardingClient,
    })),
  { ssr: false, loading: OnboardingLoading },
);

export function OnboardingEntry() {
  return (
    <div className="relative min-h-dvh w-full overflow-hidden">
      <OnboardingLazy />
    </div>
  );
}
