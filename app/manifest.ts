import type { MetadataRoute } from "next";

/**
 * PWA manifest. Served at /manifest.webmanifest by Next's metadata route.
 *
 * start_url points at the dashboard rather than the marketing page: someone who
 * installs the app has already signed up, and landing on the sales pitch every
 * launch would be wrong. Unauthenticated visitors are redirected to sign-in.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Auralis — Everything, connected.",
    short_name: "Auralis",
    description:
      "Connect the services you use. Keep the information that matters synchronized.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f8f9fb",
    theme_color: "#f8f9fb",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Connections", url: "/dashboard/connections" },
      { name: "Activity", url: "/dashboard/activity" },
    ],
  };
}
