/**
 * Every section component renders in one of two presentations:
 *  - "overlay": inside a course dialog on the dark game panels (interactive
 *    cards and tabs).
 *  - "plain": on the light one-page portfolio, with everything expanded so
 *    it reads without JavaScript.
 * The variant also namespaces element ids, so an overlay and the plain page
 * can be in the document at the same time without id clashes.
 */
export type Variant = "overlay" | "plain";

export interface SectionProps {
  variant?: Variant;
}
