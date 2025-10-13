import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.danielavila.tech/"),
  title: "Daniel Avila - Desktop Support Technician | IT Professional",
  description:
    "Daniel Avila - Experienced Desktop Support Technician at STORIS, Inc. and County College of Morris. Specializing in hardware, software installation, technical support, and IT asset management.",
  keywords: [
    "Daniel Avila",
    "Desktop Support Technician",
    "IT Support",
    "Technical Support",
    "Hardware Support",
    "Software Installation",
    "IT Help Desk",
    "Computer Repair",
    "Inventory Management",
    "STORIS",
    "County College of Morris",
  ],
  authors: [{ name: "Daniel Avila" }],
  creator: "Daniel Avila",
  publisher: "Daniel Avila",
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
    url: "https://www.danielavila.tech/",
    title: "Daniel Avila - Desktop Support Technician | IT Professional",
    description:
      "Experienced Desktop Support Technician specializing in hardware, software, and technical support. Currently working at STORIS, Inc. and County College of Morris IT Help Desk.",
    siteName: "Daniel Avila Portfolio",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Daniel Avila - Desktop Support Technician",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Daniel Avila - Desktop Support Technician",
    description:
      "Experienced Desktop Support Technician specializing in hardware, software, and technical support.",
    images: ["/og-image.png"],
  },
  verification: {
    google: "your-google-verification-code",
  },
  alternates: {
    canonical: "https://www.danielavila.tech/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#3970EB" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.bunny.net" />
        <link
          href="https://fonts.bunny.net/css?family=monda:500,700|quicksand:500,600,700"
          rel="stylesheet"
        />
      </head>
      <body
        className="antialiased bg-white text-[#212020]"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
