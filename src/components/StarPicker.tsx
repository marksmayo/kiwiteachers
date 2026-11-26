"use client";

import { useState } from "react";
import { Star } from "lucide-react";

export const STAR_LABELS: Record<number, string> = {
  0.5: "Not useful", 1: "Poor", 1.5: "Below average", 2: "Fair", 2.5: "Okay", 3: "Good",
  3.5: "Very good", 4: "Great", 4.5: "Excellent", 5: "Ka pai! Outstanding",
};

/** Half-star picker: left half of a star = .5. Keyboard: arrow keys step by 0.5. */
export function StarPicker({
  value,
  onChange,
  size = 30,
  disabled = false,
  label = "Your rating",
  onHoverChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
  size?: number;
  disabled?: boolean;
  label?: string;
  onHoverChange?: (v: number | null) => void;
}) {
  const [hover, setHoverState] = useState<number | null>(null);
  const setHover = (v: number | null) => {
    setHoverState(v);
    onHoverChange?.(v);
  };
  const shown = hover ?? value ?? 0;

  const valueFromEvent = (e: React.MouseEvent<HTMLButtonElement>, i: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX - rect.left < rect.width / 2 ? i + 0.5 : i + 1;
  };

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0.5}
      aria-valuemax={5}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value ? `${value} out of 5 stars` : "Not rated"}
      aria-disabled={disabled}
      className={`flex rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-fern/20 ${disabled ? "opacity-70" : ""}`}
      onMouseLeave={() => setHover(null)}
      onKeyDown={(e) => {
        if (disabled) return;
        const cur = value ?? 0;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          onChange(Math.min(5, cur + 0.5));
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          if (cur > 0.5) onChange(cur - 0.5);
        }
      }}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, shown - i));
        return (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            disabled={disabled}
            className="relative px-0.5 transition hover:scale-110"
            style={{ width: size + 4, height: size }}
            onMouseMove={(e) => setHover(valueFromEvent(e, i))}
            onClick={(e) => onChange(valueFromEvent(e, i))}
            aria-label={`${i + 1} stars`}
          >
            <Star className="absolute left-0.5 top-0 text-line" fill="currentColor" strokeWidth={0} style={{ width: size, height: size }} />
            {fill > 0 && (
              <span className="absolute left-0.5 top-0 overflow-hidden" style={{ width: size * fill, height: size }}>
                <Star className={hover !== null ? "text-amber-400" : "text-amber-500"} fill="currentColor" strokeWidth={0} style={{ width: size, height: size }} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
