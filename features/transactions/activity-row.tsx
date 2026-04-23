"use client";

import { useCurrency } from "@/lib/currency";
import type { ReactNode } from "react";

export type ActivityType = "buy" | "in" | "out" | "loan" | "repay";

export type ActivityItem = {
  id: string;
  type: ActivityType;
  title: string;
  subtitle?: string;
  /** Primary amount in the tx's native unit — formatted externally. */
  primary?: string;
  /** Secondary amount (e.g. IDR value of a BTC buy). */
  secondary?: string;
  /** Tint color; defaults based on type. */
  tone?: "accent" | "success" | "warning" | "danger" | "muted";
  at?: string;
};

const toneBg: Record<NonNullable<ActivityItem["tone"]>, string> = {
  accent: "var(--arka-accent-soft)",
  success: "var(--arka-success-soft)",
  warning: "var(--arka-warning-soft)",
  danger: "rgba(196,48,48,0.08)",
  muted: "var(--arka-surface-muted)",
};
const toneColor: Record<NonNullable<ActivityItem["tone"]>, string> = {
  accent: "var(--arka-accent)",
  success: "var(--arka-success)",
  warning: "var(--arka-warning)",
  danger: "var(--arka-danger)",
  muted: "var(--arka-text-muted)",
};

function DefaultIcon({ type }: { type: ActivityType }) {
  if (type === "buy")
    return <span className="text-[15px] font-extrabold">₿</span>;
  if (type === "loan") return <span className="text-[14px] font-extrabold">↗</span>;
  if (type === "repay")
    return <span className="text-[14px] font-extrabold">✓</span>;
  if (type === "out") return <span className="text-[14px] font-extrabold">↑</span>;
  return <span className="text-[14px] font-extrabold">↓</span>;
}

export function ActivityRow({
  item,
  icon,
}: {
  item: ActivityItem;
  icon?: ReactNode;
}) {
  const tone: NonNullable<ActivityItem["tone"]> = item.tone
    ? item.tone
    : item.type === "buy"
      ? "accent"
      : item.type === "in" || item.type === "repay"
        ? "success"
        : item.type === "loan"
          ? "warning"
          : "muted";

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
        style={{
          background: toneBg[tone],
          color: toneColor[tone],
        }}
      >
        {icon ?? <DefaultIcon type={item.type} />}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[13px] font-bold"
          style={{ color: "var(--arka-text)" }}
        >
          {item.title}
        </div>
        {item.subtitle ? (
          <div
            className="mt-0.5 text-[11px]"
            style={{ color: "var(--arka-text-faint)" }}
          >
            {item.subtitle}
          </div>
        ) : null}
      </div>
      <div className="text-right">
        {item.primary ? (
          <div
            className="text-[13px] font-extrabold"
            style={{
              color:
                item.type === "in" || item.type === "buy"
                  ? "var(--arka-text)"
                  : "var(--arka-text)",
            }}
          >
            {item.primary}
          </div>
        ) : null}
        {item.secondary ? (
          <div
            className="text-[11px]"
            style={{ color: "var(--arka-text-faint)" }}
          >
            {item.secondary}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Helper to format a relative "2h ago" string (simple, locale-neutral). */
export function relativeTime(iso: string | number | Date): string {
  const then = typeof iso === "object" ? iso : new Date(iso);
  const diff = Date.now() - then.getTime();
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString();
}

/** Adapter: format currency amount with the user's preferred currency. */
export function useFormatActivityAmount() {
  const { format } = useCurrency();
  return format;
}
