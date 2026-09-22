import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/providers";
import { SiteJsonLd } from "@/components/seo/site-json-ld";
import { rootMetadata } from "@/lib/site-metadata";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = rootMetadata();

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${inter.className} dark h-full antialiased`}>
      <body className="min-h-dvh bg-background font-sans text-foreground">
        <SiteJsonLd />
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
