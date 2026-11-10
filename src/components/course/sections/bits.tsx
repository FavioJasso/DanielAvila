/** Small presentational pieces shared by the section components. */
import Image from "next/image";
import type { ReactNode } from "react";

/** Wrapped list of rounded chips (tools, topics, competencies, tags). */
export function ChipList({
  items,
  label,
  tags = false,
}: {
  items: readonly string[];
  /** Accessible name for the list. */
  label: string;
  /** Square, dashed "tag" look instead of pills. */
  tags?: boolean;
}) {
  return (
    <ul className={tags ? "cx-chips cx-chips--tags" : "cx-chips"} aria-label={label}>
      {items.map((item) => (
        <li key={item} className="cx-chip">
          {item}
        </li>
      ))}
    </ul>
  );
}

/** List with gold star bullets. */
export function StarList({ items, label }: { items: readonly string[]; label?: string }) {
  return (
    <ul className="cx-starlist" aria-label={label}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * A third-party logo on a white tile (the source PNGs are 500 px squares;
 * the tile size comes from the `--cx-logo-size` custom property).
 */
export function LogoTile({ logo }: { logo: { src: string; alt: string } }) {
  return (
    <span className="cx-logo">
      <Image src={logo.src} alt={logo.alt} width={96} height={96} sizes="96px" />
    </span>
  );
}

/** External link that announces the new tab to assistive tech. */
export function ExternalLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="cx-sr"> (opens in a new tab)</span>
    </a>
  );
}
