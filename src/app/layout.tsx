import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daniel Avila - Desktop Support Technician",
  description:
    "Portfolio of Daniel Avila, Desktop Support Technician specializing in hardware, software, and technical support.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
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
