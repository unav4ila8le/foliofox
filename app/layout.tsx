import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import "./globals.css";

const urbanistSans = Urbanist({
  variable: "--font-urbanist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Patrivio - Take Control of Your Financial Future",
  description:
    "Effortlessly monitor and grow your wealth with Patrivio, the intuitive net worth tracker. Track assets, manage liabilities, and visualize your financial progress. Take control of your financial future today.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${urbanistSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
