import Link from "next/link";

import { Button } from "@/components/ui/button";

import { FeatureRows } from "@/components/homepage/feature-rows";

import portfolioImage from "@/public/images/homepage/track-everything-performance.png";
import planningImage from "@/public/images/homepage/scenario-planning-sharp.png";
import afterTaxImage from "@/public/images/changelog/2026-02/net-worth-after-tax.jpg";

const features = [
  {
    title: "Track everything",
    description:
      "Stocks, ETFs, crypto, cash and real estate in one clean net worth view. Import from any broker and stop juggling five apps and a spreadsheet.",
    image: portfolioImage,
    alt: "Foliofox net worth and one-month portfolio performance chart",
  },
  {
    title: "Understand and plan",
    description:
      "Ask anything about your finances and get answers grounded in your actual holdings. Set goals, test scenarios and see what your portfolio actually supports, whether that's retirement, a big purchase or financial independence.",
    image: planningImage,
    alt: "Foliofox scenario planning chart showing projected finances",
  },
  {
    title: "Know what you'd actually keep",
    description:
      "Your portfolio is worth less than the number on the screen, because tax hasn't been taken out yet. Foliofox shows your net worth after tax, so your plans are built on money you can actually spend.",
    image: afterTaxImage,
    alt: "Foliofox estimated net worth after capital gains tax",
  },
];

export function HomepageFeatures() {
  return (
    <section className="bg-muted/40 relative left-1/2 w-screen -translate-x-1/2 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-3">
        <h2 className="max-w-3xl text-3xl tracking-tight text-balance md:text-4xl">
          One place for your whole financial life
        </h2>
        <p className="text-muted-foreground mt-4 max-w-3xl text-lg leading-8">
          Track what you own, understand what it means, and keep more of it.
        </p>
        <div className="mt-14">
          <FeatureRows rows={features} />
        </div>
        <div className="mt-14 text-center">
          <Button
            asChild
            size="lg"
            className="bg-brand hover:bg-brand/90 dark:text-primary rounded-lg px-6 text-base"
          >
            <Link href="/dashboard">Get started free</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
