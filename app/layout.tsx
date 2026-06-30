import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DrugCraft — Grow Your Empire",
  description:
    "A Hay Day–style farming game. Plant, grow and sell tobacco, cannabis, coca and more to build your farming empire.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
