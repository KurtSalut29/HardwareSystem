import type { MetadataRoute } from "next";
import { STORE_NAME } from "@/lib/brand";

/**
 * Makes RM Hardware installable as an app (home screen on phones, taskbar or
 * dock on computers). Opening the app goes to the login page, which sends a
 * signed-in user straight to their dashboard.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: STORE_NAME,
    short_name: STORE_NAME,
    description: `${STORE_NAME} — orders, deliveries, stock and sales in one place.`,
    start_url: "/login",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#FFFFFF",
    theme_color: "#1E4FD8",
    categories: ["business", "shopping", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
