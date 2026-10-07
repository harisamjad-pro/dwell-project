import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dwell — Search for how a home feels",
  description:
    "Natural-language property search powered by semantic retrieval, structured filters, and transparent match explanations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
