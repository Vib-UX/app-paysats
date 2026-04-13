"use client";

import dynamic from "next/dynamic";

const OnboardingPlaceholder = dynamic(
  () =>
    import("@/features/onboarding/onboarding-placeholder").then((m) => ({
      default: m.OnboardingPlaceholder,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="h-8 w-8 animate-pulse rounded-full bg-arka-border" />
      </div>
    ),
  },
);

export function OnboardingEntry() {
  return <OnboardingPlaceholder />;
}
