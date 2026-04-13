import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-arka-accent text-white hover:bg-arka-accent-muted active:scale-[0.99] disabled:opacity-50",
  secondary:
    "bg-arka-surface border border-arka-border text-arka-text hover:bg-arka-surface-muted",
  ghost: "text-arka-accent hover:bg-arka-surface-muted",
};

export function Button({
  children,
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
}) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] px-4 text-sm font-medium transition disabled:pointer-events-none ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
