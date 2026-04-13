import type { ReactNode } from "react";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-arka-surface-muted text-arka-text",
  info: "bg-amber-50 text-arka-accent",
  success: "bg-emerald-50 text-arka-success",
  warning: "bg-yellow-50 text-arka-warning",
  danger: "bg-red-50 text-arka-danger",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
