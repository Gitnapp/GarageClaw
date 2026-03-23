import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GarageClaw Platform",
  description: "GarageClaw web platform — marketplace, profile & credits",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
