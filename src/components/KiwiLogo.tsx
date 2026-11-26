export function KiwiMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill="#1f5c3f" />
      {/* body */}
      <ellipse cx="29" cy="36" rx="15" ry="11.5" fill="#8a6a3d" />
      {/* head */}
      <circle cx="41" cy="27" r="6.5" fill="#8a6a3d" />
      {/* beak */}
      <path d="M46.5 28.5 C 52 31, 55 35, 57 41" stroke="#e9d9b6" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      {/* eye */}
      <circle cx="42.5" cy="25.5" r="1.3" fill="#17251e" />
      {/* legs */}
      <path d="M26 46 L24 52 M24 52 L21 53 M24 52 L26.5 53.5 M33 46.5 L34 52 M34 52 L31 53.5 M34 52 L37 53" stroke="#e9d9b6" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* feather texture */}
      <path d="M20 33 q3 -2 6 0 M23 38 q3 -2 6 0 M30 31 q3 -2 6 0" stroke="#6f5430" strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Koru({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" fill="none">
      <path
        d="M100 190 C 100 120, 40 110, 40 70 C 40 35, 70 15, 100 15 C 140 15, 165 45, 165 80 C 165 110, 142 130, 115 130 C 92 130, 76 114, 76 93 C 76 75, 90 62, 106 62 C 121 62, 132 73, 132 87 C 132 99, 123 107, 112 107 C 103 107, 97 101, 97 93"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
      />
    </svg>
  );
}
