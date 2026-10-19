import { useId } from "react";

// The CampusDeck mark: a "C" for campus with one slide dealt off it — the deck.
export function LogoMark({ size = 28 }: { size?: number }) {
  const gradient = "cd-mark-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg
      className="cd-logo-mark"
      width={size}
      height={size}
      viewBox="0 0 28 28"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22365A" />
          <stop offset="1" stopColor="#101B30" />
        </linearGradient>
      </defs>
      <rect width="28" height="28" rx="8" fill={`url(#${gradient})`} />
      <rect
        x="0.5"
        y="0.5"
        width="27"
        height="27"
        rx="7.5"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.1"
      />
      <path
        d="M18.4 10.3A6.6 6.6 0 1 0 18.4 18.7"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <g className="cd-logo-card">
        <rect
          x="16.2"
          y="5.9"
          width="7.6"
          height="5.4"
          rx="1.4"
          fill="#4C78FF"
          transform="rotate(-16 20 8.6)"
        />
      </g>
    </svg>
  );
}
