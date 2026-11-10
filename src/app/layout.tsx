import type { Metadata, Viewport } from "next";
import { Outfit, Press_Start_2P, Titan_One } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { profile, SITE_URL } from "@/content/portfolio";
import { StructuredData } from "@/components/seo/StructuredData";
import {
  GAME_NAME,
  OG_IMAGE,
  SITE_NAME,
  siteDescription,
  siteKeywords,
  siteTitle,
  socialDescription,
  THEME_COLOR,
} from "@/components/seo/site";
import "./globals.css";

/* Fonts are self-hosted by next/font (no layout shift, no third-party request).
   --font-display: chunky cartridge-era headings and logo
   --font-pixel:   small HUD labels and button prompts
   --font-body:    all readable portfolio text */
const fontDisplay = Titan_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-titan",
  display: "swap",
});
const fontPixel = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel-face",
  display: "swap",
});
const fontBody = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Let the game canvas run under the notch / home indicator.
  viewportFit: "cover",
  themeColor: THEME_COLOR,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: siteTitle,
    template: `%s | ${profile.name}`,
  },
  description: siteDescription,
  applicationName: GAME_NAME,
  keywords: siteKeywords,
  authors: [{ name: profile.name, url: SITE_URL }],
  creator: profile.name,
  publisher: profile.name,
  category: "technology",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: SITE_NAME,
    title: siteTitle,
    description: socialDescription,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: socialDescription,
    images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
  },
  /* src/app/favicon.ico is linked by Next automatically and listed first.
     /icon.png is src/app/icon.png; the rest live in public/. */
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // Anchor links glide only for visitors who have not asked for reduced motion.
      className={`motion-safe:scroll-smooth ${fontDisplay.variable} ${fontPixel.variable} ${fontBody.variable}`}
    >
      {/* The `!` (important) variants are needed while globals.css still carries
          the previous site's un-layered `body { background; color; font-family }`
          rule, which otherwise beats Tailwind's layered utilities. */}
      <body className="font-body! antialiased bg-ink! text-cream!">
        <StructuredData />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
