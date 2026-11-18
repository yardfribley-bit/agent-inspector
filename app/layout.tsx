import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Inspector — AI Agent & Fingerprint Detection",
  description:
    "Real-time detection of AI Agents, bots, and browser environment fingerprints powered by FingerprintJS.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
