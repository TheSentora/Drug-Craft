import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DrugCraft",
    short_name: "DrugCraft",
    description: "A farming game — grow tobacco, cannabis, coca and more.",
    start_url: "/",
    display: "fullscreen",
    orientation: "landscape",
    background_color: "#0c241a",
    theme_color: "#0c241a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
