import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Auralis — Everything, connected.",
    template: "%s — Auralis",
  },
  description:
    "Connect the services you use. Keep the information that matters synchronized. Auralis runs quietly in the background so you only change something once.",
  openGraph: {
    title: "Auralis — Everything, connected.",
    description:
      "Connect the services you use. Keep the information that matters synchronized.",
    siteName: "Auralis",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d0c" },
  ],
};

/**
 * Applied before first paint so a user who chose a theme never sees the other
 * one flash first.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('auralis-theme');
    if (stored === 'dark' || stored === 'light') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
