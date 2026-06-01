import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

export const metadata: Metadata = {
  title: "CVZN Studios — Book a Shoot",
  description: "Book your property photography or video shoot with CVZN Studios.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="min-h-full bg-[#0a0a0a] text-white font-sans antialiased">
        {children}
        <div id="pt-overlay" aria-hidden="true" />
      </body>
    </html>
  );
}
