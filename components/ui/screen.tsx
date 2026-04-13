import type { ReactNode } from "react";

export function Screen({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="px-4 pb-28 pt-4">
      {title ? (
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-arka-text">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm leading-relaxed text-arka-text-muted">
              {subtitle}
            </p>
          ) : null}
        </header>
      ) : null}
      {children}
    </div>
  );
}
