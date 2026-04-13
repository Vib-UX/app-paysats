import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Arka — Tabungan Bitcoin",
  description:
    "Produk Arka: onboarding IDRX, mint stabil, dan persiapan tabungan Bitcoin.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${dmSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* Extensions (e.g. password managers) inject attributes on <body>; suppress avoids false hydration errors. */}
      <body
        className="min-h-full flex flex-col bg-arka-bg"
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
