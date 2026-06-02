import type { CSSProperties } from "react";

type LogoMarkProps = {
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
};

export function LogoMark({
  size = 24,
  color = "#ffffff",
  className,
  style,
}: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill={color}
      className={className}
      style={{ display: "block", ...style }}
      aria-hidden
    >
      <rect x="15" y="18" width="17" height="64" rx="8.5" />
      <rect x="68" y="18" width="17" height="64" rx="8.5" />
      <circle cx="50" cy="50" r="9" />
    </svg>
  );
}

type LogoTileProps = {
  size?: number;
  shadow?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function LogoTile({
  size = 40,
  shadow = true,
  className,
  style,
}: LogoTileProps) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        background: "var(--paysats-gradient)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: shadow ? "var(--paysats-shadow-tile)" : "none",
        flexShrink: 0,
        ...style,
      }}
    >
      <LogoMark size={size * 0.58} color="#ffffff" />
    </div>
  );
}

type LockupProps = {
  markSize?: number;
  fontSize?: number;
  color?: string;
  gap?: number;
  gradient?: boolean;
  className?: string;
};

export function Lockup({
  markSize = 32,
  fontSize = 26,
  color = "#ffffff",
  gap = 10,
  gradient = false,
  className,
}: LockupProps) {
  return (
    <div
      className={className}
      style={{ display: "flex", alignItems: "center", gap }}
    >
      {gradient ? (
        <LogoTile size={markSize} />
      ) : (
        <LogoMark size={markSize} color={color} />
      )}
      <span
        style={{
          fontSize,
          fontWeight: 800,
          color,
          letterSpacing: "-0.03em",
        }}
      >
        PaySats
      </span>
    </div>
  );
}
