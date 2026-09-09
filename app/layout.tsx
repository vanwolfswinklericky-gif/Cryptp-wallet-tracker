// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crypto Wallet Tracker | Multi-Chain Portfolio",
  description: "Track balances, tokens, transactions, and portfolio analytics across multiple chains in deep dark mode.",
  keywords: ["crypto wallet", "blockchain tracker", "portfolio analytics", "multi-chain", "defi"],
  authors: [{ name: "Crypto Wallet Tracker" }],
  openGraph: {
    title: "Crypto Wallet Tracker | Multi-Chain Portfolio",
    description: "Track balances, tokens, transactions, and portfolio analytics across multiple chains.",
    type: "website",
    url: "https://cryptp-wallet-tracker.vercel.app",
  },
  twitter: {
    card: "summary_large_image",
    title: "Crypto Wallet Tracker | Multi-Chain Portfolio",
    description: "Track balances, tokens, transactions, and portfolio analytics across multiple chains.",
  },
};

export const viewport: Viewport = {
  themeColor: "#050b08",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html 
      lang="en" 
      className="dark" 
      style={{ colorScheme: "dark" }}
      suppressHydrationWarning
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-[#050b08] text-emerald-50/90 selection:bg-emerald-500/30 selection:text-emerald-200 min-h-screen`}
      >
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}