import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Summer Shred",
    short_name: "Shred",
    description: "Monthly fitness challenge dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#f5efe4",
    theme_color: "#b56a3a",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon.svg",
        sizes: "180x180",
        type: "image/svg+xml",
      },
    ],
  };
}
