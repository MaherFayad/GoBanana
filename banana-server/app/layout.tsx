import type { Metadata } from "next";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Wild design references and a moodboard canvas for your AI agent.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
