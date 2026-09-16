import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "SerpApi tools for the AI SDK",
  description:
    "A chat demo of serpapi-ai-sdk-tools: web, news, maps, shopping, flights and hotels search for Vercel AI SDK apps.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
