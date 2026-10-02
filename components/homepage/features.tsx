import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import portfolioImage from "@/public/images/homepage/track-everything-performance.png";
import planningImage from "@/public/images/homepage/scenario-planning-sharp.png";
import afterTaxImage from "@/public/images/changelog/2026-02/net-worth-after-tax.jpg";

const features = [
  {
    title: "Track everything",
    description:
      "Stocks, ETFs, crypto, cash and real estate in one clean net worth view. Import from any broker and stop juggling five apps and a spreadsheet.",
    image: portfolioImage,
    alt: "FolioFox net worth and one-month portfolio performance chart",
  },
  {
    title: "Understand and plan",
    description:
      "Ask anything about your finances and get answers grounded in your actual holdings. Set goals, test scenarios and see what your portfolio actually supports, whether that's retirement, a big purchase or financial independence.",
    image: planningImage,
    alt: "FolioFox scenario planning chart showing projected finances",
  },
  {
    title: "Know what you'd actually keep",
    description:
      "Your portfolio is worth less than the number on the screen, because tax hasn't been taken out yet. FolioFox shows your net worth after tax, so your plans are built on money you can actually spend.",
    image: afterTaxImage,
    alt: "FolioFox estimated net worth after capital gains tax",
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
        <div className="mt-14 space-y-20 md:space-y-28">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="grid items-center gap-8 md:grid-cols-2 md:gap-14"
            >
              <div className={index === 1 ? "max-w-lg md:order-2" : "max-w-lg"}>
                <h3 className="text-2xl font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground mt-4 leading-7">
                  {feature.description}
                </p>
              </div>
              <div
                className={`relative aspect-[1080/666] overflow-hidden rounded-lg ${index === 1 ? "md:order-1" : ""}`}
              >
                <Image
                  fill
                  src={feature.image}
                  alt={feature.alt}
                  className="object-cover"
                  sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-14 text-center">
          <Button
            asChild
            size="lg"
            className="bg-brand hover:bg-brand/90 dark:text-primary rounded-lg px-6 text-base"
          >
            <Link href="/dashboard">Get started free →</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
