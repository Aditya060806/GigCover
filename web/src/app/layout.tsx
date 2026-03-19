import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "GigCover — AI-Powered Parametric Insurance for Gig Workers",
  description:
    "Parametric insurance platform that automatically protects gig workers from income loss due to weather, pollution, and external disruptions. Powered by AI risk assessment and instant payouts.",
  keywords: [
    "gig workers",
    "parametric insurance",
    "income protection",
    "AI insurance",
    "delivery partners",
    "weather insurance",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
        <Toaster
          theme="light"
          position="top-right"
          toastOptions={{
            style: {
              background: "white",
              border: "1px solid hsl(214 32% 91%)",
              color: "hsl(222 47% 11%)",
            },
          }}
        />
      </body>
    </html>
  );
}
