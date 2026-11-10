/**
 * The gold five-point star used across the HUD, pause menu and overlays.
 * Original artwork (a plain geometric star) — deliberately no face.
 */
export function StarIcon({
  size = 24,
  filled = true,
  className,
  title,
}: {
  size?: number;
  filled?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        d="M12 1.6l3.1 6.5 7.1.9-5.2 4.9 1.4 7-6.4-3.5-6.4 3.5 1.4-7L1.8 9l7.1-.9z"
        fill={filled ? "var(--star)" : "rgba(255,255,255,0.12)"}
        stroke="var(--ink)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {filled && (
        <path
          d="M12 4.6l1.9 4 4.3.6-3.2 3 .9 4.2-3.9-2.1z"
          fill="var(--star-deep)"
          opacity="0.55"
        />
      )}
    </svg>
  );
}
