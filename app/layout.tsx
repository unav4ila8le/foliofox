import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${urbanistSans.variable} antialiased transition-all`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
