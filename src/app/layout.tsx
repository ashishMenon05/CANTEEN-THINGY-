import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Q-Pass — Offline-First College Canteen Pre-Ordering & Fast Pickup",
  description:
    "Zero-login college canteen pre-ordering, atomic 10-minute inventory holds, cryptographically secure QR receipts, and offline pickup credentials.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full bg-slate-950 text-slate-100">
      <body className="min-h-full font-sans antialiased bg-slate-950 text-slate-100 selection:bg-orange-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
