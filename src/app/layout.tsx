import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono-jb",
  subsets: ["latin"],
  display: "swap",
});

const instrument = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const SITE = "https://marque-ide.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Marque — a browser IDE that signs its own work",
    template: "%s · Marque",
  },
  description:
    "Marque is a code workspace that runs in the browser. Every edit an AI agent makes is hashed, signed with your keypair, and anchored to Solana, so the authorship of a codebase can be checked rather than assumed.",
  keywords: [
    "browser IDE",
    "code provenance",
    "AI agent attestation",
    "Solana",
    "Open VSX",
    "Monaco editor",
  ],
  authors: [{ name: "Marque" }],
  openGraph: {
    type: "website",
    url: SITE,
    title: "Marque — a browser IDE that signs its own work",
    description:
      "Every AI edit hashed, signed, and anchored on Solana. 17,000+ extensions from Open VSX, with 2,000 pinned for offline use. Runs entirely in the browser.",
    siteName: "Marque",
  },
  twitter: {
    card: "summary_large_image",
    title: "Marque — a browser IDE that signs its own work",
    description:
      "Every AI edit hashed, signed, and anchored on Solana. Runs entirely in the browser.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0A0908",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrains.variable} ${instrument.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
