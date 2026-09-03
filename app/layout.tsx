import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/register-sw";

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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Auralis",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f8f9fb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
