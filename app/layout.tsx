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
  themeColor: "#f7f6f3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
