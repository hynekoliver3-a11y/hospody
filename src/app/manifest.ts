import type { MetadataRoute } from "next";
import { getMessages } from "@/i18n/messages";
import { defaultLocale } from "@/i18n/config";

export default function manifest(): MetadataRoute.Manifest {
  const m = getMessages(defaultLocale);
  return {
    name: m.app.name,
    short_name: "HACCP",
    description: m.app.tagline,
    lang: defaultLocale,
    start_url: "/tablet",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f1f5f9",
    theme_color: "#0b3b75",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
