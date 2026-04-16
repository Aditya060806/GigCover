import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GigCover — Parametric Insurance for Gig Workers",
    short_name: "GigCover",
    description:
      "AI-powered income protection for India's delivery workers. Automatic payouts when weather strikes.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0d9488",
    orientation: "portrait-primary",
    categories: ["finance", "insurance", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "My Claims",
        short_name: "Claims",
        description: "View your claims and payouts",
        url: "/dashboard/claims",
      },
      {
        name: "My Policy",
        short_name: "Policy",
        description: "View active coverage details",
        url: "/dashboard/policy",
      },
      {
        name: "My Wallet",
        short_name: "Wallet",
        description: "View wallet balance and transactions",
        url: "/dashboard/wallet",
      },
    ],
  };
}
