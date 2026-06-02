import type { ButtonHTMLAttributes, ReactNode } from "react";

export function GradButton({
  children,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 w-full items-center justify-center rounded-[var(--radius-pill)] px-4 text-sm font-extrabold text-white disabled:pointer-events-none disabled:opacity-60 ${className}`}
      style={{
        background: "var(--paysats-gradient)",
        boxShadow: "0 6px 24px rgba(170,80,40,0.22)",
      }}
      {...props}
    >
      {children}
    </button>
  );
}
