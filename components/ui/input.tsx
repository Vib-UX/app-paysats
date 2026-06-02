import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-11 w-full rounded-[var(--radius-control)] border border-paysats-border bg-paysats-surface px-3 text-base text-paysats-text outline-none ring-paysats-accent/30 placeholder:text-paysats-text-muted/70 focus:ring-2 ${className}`}
      {...props}
    />
  );
}

export function TextArea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`min-h-24 w-full rounded-[var(--radius-control)] border border-paysats-border bg-paysats-surface px-3 py-2 text-base text-paysats-text outline-none ring-paysats-accent/30 placeholder:text-paysats-text-muted/70 focus:ring-2 ${className}`}
      {...props}
    />
  );
}

export function Label({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-sm font-medium text-paysats-text-muted"
    >
      {children}
    </label>
  );
}
