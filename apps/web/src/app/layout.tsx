import type { Metadata } from "next";
import { Plus_Jakarta_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import React from "react";

// Load fonts (no variables, just class names for now)
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  // Remove variable if it causes issues: variable: "--font-sans",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  // Remove variable if it causes issues: variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Podacium",
  description: "Clean. Elegant. Perfect.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${jakarta.className} ${dmMono.className}`}
      suppressHydrationWarning
    >
      <body
        style={{
          backgroundColor: "white",
          color: "black",
          fontFamily: `'Plus Jakarta Sans', sans-serif`,
          minHeight: "100vh",
          margin: 0,
          padding: 0,
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        }}
      >
        <main>{children}</main>
      </body>
    </html>
  );
}
