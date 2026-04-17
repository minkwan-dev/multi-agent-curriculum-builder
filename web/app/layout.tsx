import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-ui-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Vite",
  description: "Multi-agent curriculum pipeline — research, review, and build.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sans.variable} font-sans font-medium antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
