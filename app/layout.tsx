import type { Metadata, Viewport } from "next";
import { Caveat } from "next/font/google";
import "./globals.css";

// Handwriting font for Chikkie's welcome book.
const handwriting = Caveat({
  subsets: ["latin"],
  variable: "--font-handwriting",
});

export const metadata: Metadata = {
  title: "DrugCraft",
  description: "A farming game — grow tobacco, cannabis, coca and more.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DrugCraft",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0c241a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={handwriting.variable}>
      <body>{children}</body>
    </html>
  );
}
