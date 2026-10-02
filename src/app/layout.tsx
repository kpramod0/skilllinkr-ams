import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClientProviders } from "@/components/layout/ClientProviders";
import { OfflineBoundary } from "@/components/logic/OfflineBoundary";
import "./globals.css";

import { generateMetadata as getGlobalMetadata } from "@/config/seo";
import { OrganizationSchema, WebSiteSchema } from "@/components/seo/JsonLd";

const geistSans = { variable: "--font-geist-sans" };
const geistMono = { variable: "--font-geist-mono" };

export const metadata: Metadata = {
  metadataBase: new URL("https://www.skilllinkr.com"),
  ...getGlobalMetadata({}),
  icons: {
    icon: "/skilllinkr-logo.png?v=2",
    apple: "/skilllinkr-logo.png?v=2",
  },
  manifest: "/site.webmanifest",
};

export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};
// This small blocking script runs BEFORE React hydrates, preventing the
// white flash and the hydration mismatch on the theme toggle icon.
const themeInitScript = `
  (function() {
    try {
      var stored = localStorage.getItem('theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var theme = stored === 'light' ? 'light' : (stored === 'dark' ? 'dark' : (prefersDark ? 'dark' : 'light'));
      document.documentElement.classList.add(theme);
    } catch (e) {
      document.documentElement.classList.add('dark');
    }
  })();
`;

import { PostHogProvider } from "@/components/providers/posthog-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Blocking script — runs before any paint to set the correct theme class */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <OfflineBoundary />
        <OrganizationSchema />
        <WebSiteSchema />
        <PostHogProvider>
          <ClientProviders>
            {children}
          </ClientProviders>
        </PostHogProvider>
      </body>
    </html>
  );
}
