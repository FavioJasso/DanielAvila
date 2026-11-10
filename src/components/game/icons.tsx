/** Original line icons for the game UI. All decorative (`aria-hidden`). */

interface IconProps {
  size?: number;
  className?: string;
}

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function SpeakerIcon({ muted, size = 22, className }: IconProps & { muted: boolean }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M3.5 9.2h3.6l4.6-3.9v13.4l-4.6-3.9H3.5z" fill="currentColor" />
      {muted ? (
        <path d="M15.6 9.4l5 5.2M20.6 9.4l-5 5.2" />
      ) : (
        <>
          <path d="M15.2 9.2a4 4 0 010 5.6" />
          <path d="M17.9 6.6a7.7 7.7 0 010 10.8" />
        </>
      )}
    </svg>
  );
}

export function ChevronIcon({ dir, size = 14, className }: IconProps & { dir: "left" | "right" }) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeWidth={0}>
      <path
        d={dir === "left" ? "M17.5 3.5v17L5 12z" : "M6.5 3.5v17L19 12z"}
        fill="currentColor"
      />
    </svg>
  );
}

export function DownloadIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 3.5v11M7.2 10.4l4.8 4.6 4.8-4.6M4.5 19.5h15" />
    </svg>
  );
}

export function PageIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M6 3.5h8.5L18.5 7.5v13H6zM9.2 11.5h6M9.2 15.5h6" />
    </svg>
  );
}

export function CloseIcon({ size = 18, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
    </svg>
  );
}
