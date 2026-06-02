import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-paysats-accent text-white hover:bg-paysats-accent-muted active:scale-[0.99] disabled:opacity-50",
  secondary:
    "bg-paysats-surface border border-paysats-border text-paysats-text hover:bg-paysats-surface-muted",
  ghost: "text-paysats-accent hover:bg-paysats-surface-muted",
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
