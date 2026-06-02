"use client";

import { useEffect } from "react";

/**
 * First-paint splash. Renders a gradient tile with the logo mark assembling
 * (two bars + center dot). Calls onDone once the animation has played.
 */
export function Splash({
  onDone,
  duration = 1800,
}: {
  onDone?: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!onDone) return;
    const t = window.setTimeout(onDone, duration);
    return () => window.clearTimeout(t);
  }, [onDone, duration]);

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ background: "var(--paysats-bg)" }}
    >
      <div
        className="relative flex items-center justify-center"
        style={{
          width: 140,
          height: 140,
          borderRadius: 36,
          background: "var(--paysats-gradient)",
          boxShadow: "0 14px 48px rgba(170,80,40,0.28)",
          animation: "tile-in 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s forwards",
          opacity: 0,
          transform: "scale(0.82)",
        }}
      >
        <div className="relative" style={{ width: 84, height: 84 }}>
          <span
            className="absolute"
            style={{
              left: "15%",
              top: "18%",
              width: "17%",
              height: "64%",
              borderRadius: 6,
              background: "#fff",
              opacity: 0,
              animation:
                "bar-rise 0.5s cubic-bezier(0.16,1,0.3,1) 0.45s forwards",
            }}
          />
          <span
            className="absolute"
            style={{
              right: "15%",
              top: "18%",
              width: "17%",
              height: "64%",
              borderRadius: 6,
              background: "#fff",
              opacity: 0,
              animation:
                "bar-rise 0.5s cubic-bezier(0.16,1,0.3,1) 0.55s forwards",
            }}
          />
          <span
            className="absolute"
            style={{
              left: "41%",
              top: "41%",
              width: "18%",
              height: "18%",
              borderRadius: "50%",
              background: "#fff",
              opacity: 0,
              animation:
                "dot-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.95s forwards",
            }}
          />
        </div>
      </div>
    </div>
  );
}
