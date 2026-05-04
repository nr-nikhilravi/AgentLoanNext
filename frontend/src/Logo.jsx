import React from "react";

/**
 * Future Bank of India logo:
 * a stylized 'F' integrated with a digital circuit pulse.
 *
 * Two color stops: Electric Blue #0047FF + Transformative Teal #00BFA5.
 */
export default function Logo({ size = 36, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Future Bank of India"
    >
      <defs>
        <linearGradient id="fbi-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0047FF" />
          <stop offset="1" stopColor="#00BFA5" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="14" fill="url(#fbi-grad)" />

      {/* Stylized F */}
      <path
        d="M18 14h26v8H28v8h12v8H28v12h-10z"
        fill="white"
      />

      {/* Circuit pulse — runs from F into the corner */}
      <g
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      >
        <path d="M44 22 h6 v6 h6" />
        <path d="M44 30 h10" strokeDasharray="3 3" className="animate-circuit" />
      </g>
      <circle cx="56" cy="28" r="2.6" fill="white" />
      <circle cx="56" cy="28" r="4.5" fill="white" opacity="0.18" />
    </svg>
  );
}
