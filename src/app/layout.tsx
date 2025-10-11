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
      <body className="antialiased bg-white text-gray-900" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
