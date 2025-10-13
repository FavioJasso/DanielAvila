import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daniel Avila - Desktop Support Technician",
  description: "Portfolio of Daniel Avila, Desktop Support Technician specializing in hardware, software, and technical support.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@500;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.cdnfonts.com/css/techno" rel="stylesheet" />
      </head>
      <body className="antialiased bg-white text-[#212020]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
