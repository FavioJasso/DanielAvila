/** Small inline line icons (original, generic glyphs — no brand marks). */
export type IconName =
  | "mail"
  | "phone"
  | "pin"
  | "profile"
  | "code"
  | "download"
  | "external"
  | "check"
  | "calendar"
  | "briefcase";

const PATHS: Record<IconName, string> = {
  mail: "M3 6.5h18v11H3zM3.5 7l8.5 6.5L20.5 7",
  phone:
    "M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z",
  pin: "M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  profile: "M4 4.5h16v15H4zM9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 16c.4-2 1.5-3 3-3s2.6 1 3 3M14.5 9h3M14.5 12.5h3",
  code: "M8.5 7.5 4 12l4.5 4.5M15.5 7.5 20 12l-4.5 4.5M13.5 5l-3 14",
  download: "M12 3.5v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15",
  external: "M10 5H5v14h14v-5M13.5 4.5h6v6M19.5 4.5 11 13",
  check: "M4.5 12.5 10 18 19.5 6.5",
  calendar: "M4 6h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4",
  briefcase: "M3.5 8h17v11.5h-17zM9 8V5.5h6V8M3.5 13h17",
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className ? `cx-icon ${className}` : "cx-icon"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "check" ? 3 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
