"use client";

import { useEffect, useRef } from "react";

export function TimeDrumColumn({
  items,
  value,
  onChange,
  width = 52,
  itemHeight = 36,
}: {
  items: number[];
  value: number;
  onChange: (v: number) => void;
  width?: number;
  itemHeight?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const idx = items.indexOf(value);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = idx * itemHeight;
    }
  }, [idx, itemHeight]);

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: itemHeight * 3, width }}
    >
      <div
        className="pointer-events-none absolute left-0 right-0 rounded-[8px] bg-arka-surface-muted"
        style={{ top: itemHeight, height: itemHeight, zIndex: 0 }}
      />
      <div
        ref={ref}
        className="no-scrollbar relative h-full overflow-y-scroll"
        style={{
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          zIndex: 1,
        }}
        onScroll={(e) => {
          const target = e.currentTarget;
          const si = Math.round(target.scrollTop / itemHeight);
          if (si >= 0 && si < items.length && items[si] !== value) {
            onChange(items[si]);
          }
        }}
      >
        {[null, ...items, null].map((item, i) => {
          const isCenter = item !== null && item === value;
          const distance =
            item === null ? 2 : Math.abs(items.indexOf(item) - idx);
          return (
            <div
              key={i}
              className="flex items-center justify-center"
              style={{
                height: itemHeight,
                scrollSnapAlign: "start",
              }}
            >
              {item !== null && (
                <span
                  className="transition-all"
                  style={{
                    fontSize: isCenter ? 20 : 14,
                    fontWeight: isCenter ? 800 : 500,
                    color: isCenter
                      ? "var(--arka-text)"
                      : distance === 1
                        ? "var(--arka-text-faint)"
                        : "transparent",
                  }}
                >
                  {String(item).padStart(2, "0")}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TimeDrum({
  hour,
  minute,
  onChange,
  minuteStep = 5,
}: {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  minuteStep?: 1 | 5 | 15;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from(
    { length: Math.floor(60 / minuteStep) },
    (_, i) => i * minuteStep,
  );

  return (
    <div className="flex items-center justify-center gap-0">
      <TimeDrumColumn
        items={hours}
        value={hour}
        onChange={(h) => onChange(h, minute)}
      />
      <span
        className="text-[22px] font-extrabold"
        style={{ color: "var(--arka-text-faint)" }}
      >
        :
      </span>
      <TimeDrumColumn
        items={minutes}
        value={minute}
        onChange={(m) => onChange(hour, m)}
      />
    </div>
  );
}
