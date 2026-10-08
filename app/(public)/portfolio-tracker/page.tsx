import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { HeroImage } from "@/components/homepage/hero/image";
import { FeatureRows } from "@/components/homepage/feature-rows";
import { HomepageTestimonials } from "@/components/homepage/testimonials";

import advisorImage from "@/public/images/homepage/advisor-takes-action-sharp.png";
import performanceImage from "@/public/images/changelog/2026-03/portfolio-performance.jpg";
import brokerImportImage from "@/public/images/homepage/portfolio-tracker-import-v3.png";

export const metadata: Metadata = {
  title: "Free Portfolio Tracker with AI Insights",
  description:
    "Track stocks, ETFs, crypto and your full net worth in one place. Foliofox is a free portfolio tracker with AI powered analysis and planning built in.",
  alternates: {
    canonical: "/portfolio-tracker",
  },
};

const steps = [
  {
    eyebrow: "Step 1",
    title: "Import your investments",
    description:
      "Add holdings through CSV upload, supported broker imports or manual entry. Bank connection is coming soon. Your portfolio lands in one place.",
    image: brokerImportImage,
    alt: "Importing investments into the Foliofox portfolio tracker",
    imageClassName: "scale-[1.14] object-cover",
  },
  {
    eyebrow: "Step 2",
    title: "See your real performance",
    description:
      "Returns, allocation, history and net worth over time. Understand what's actually driving your portfolio instead of guessing from account balances.",
    image: performanceImage,
    alt: "Foliofox investment performance and allocation view",
  },
  {
    eyebrow: "Step 3",
    title: "Ask the AI what's next",
    description:
      "Get personalized insights on your allocation, risk and goals. It's like having a financial planner who has already read every line of your portfolio.",
    image: advisorImage,
    alt: "Foliofox AI insights analyzing a portfolio",
  },
];

export default function PortfolioTrackerPage() {
  return (
    <div className="mx-auto max-w-7xl px-3 pt-16 md:pt-24">
      <section>
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-muted-foreground text-sm font-medium">
            $100M+ assets tracked · Free to start
          </p>
          <h1 className="mt-4 text-4xl tracking-tight text-balance sm:text-5xl md:text-6xl">
            The AI portfolio tracker that helps you reach your financial goals
          </h1>
          <p className="text-foreground/80 mx-auto mt-6 max-w-3xl text-lg leading-8">
            Import your holdings and see everything in one clean dashboard.
            Foliofox is a free portfolio tracking app that goes beyond charts:
            our built in AI analyzes your investments, flags risks, and helps
            you plan your next move.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-brand hover:bg-brand/90 dark:text-primary mt-8 rounded-lg px-6 text-base"
          >
            <Link href="/dashboard">Start tracking for free</Link>
          </Button>
        </div>

        <div className="mt-12 mask-b-from-60%">
          <HeroImage alt="Foliofox portfolio tracker dashboard showing holdings and performance" />
        </div>
      </section>

      <section className="border-t py-20 md:py-28">
        <div className="max-w-2xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">
            A portfolio tracker unlike any other
          </h2>
          <p className="text-muted-foreground mt-4 text-lg leading-8">
            Plenty of apps show you a line going up or down. Here&apos;s why
            Foliofox stands apart from every other investment tracker out there.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="border-l-brand/70 rounded-r-lg border-l-2 p-6">
            <h3 className="text-xl font-semibold">
              Every asset, one dashboard
            </h3>
            <p className="text-muted-foreground mt-3 leading-7">
              Stocks, ETFs, crypto and cash, tracked together with daily market
              updates. Consolidate accounts across brokers and watch your full
              net worth instead of juggling five apps and a spreadsheet.
            </p>
          </div>
          <div className="border-l-brand/70 rounded-r-lg border-l-2 p-6">
            <h3 className="text-xl font-semibold">AI analysis built in</h3>
            <p className="text-muted-foreground mt-3 leading-7">
              This is where portfolio tracking ends and portfolio intelligence
              begins. Foliofox reads your actual allocation and surfaces
              concentration risks, performance drivers and opportunities
              specific to your holdings, not generic market commentary.
            </p>
          </div>
          <div className="border-l-brand/70 rounded-r-lg border-l-2 p-6">
            <h3 className="text-xl font-semibold">Free portfolio tracking</h3>
            <p className="text-muted-foreground mt-3 leading-7">
              The core tracker is free. No trial countdown, no card required.
              Import your investments and get a clear picture of your money in
              minutes.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-muted/40 relative left-1/2 w-screen -translate-x-1/2 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-3">
          <FeatureRows rows={steps} />
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">
            See your whole financial picture, finally
          </h2>
          <div className="text-muted-foreground mt-6 space-y-5 text-lg leading-8">
            <p>
              Most investors don&apos;t have one portfolio. They have a
              brokerage account here, a retirement account there, some crypto on
              an exchange, and a rough number in their head.
            </p>
            <p>
              Foliofox pulls it together. Our net worth tracker consolidates
              every account so you can monitor your complete financial position
              in one place, spot overexposure across accounts, and measure
              progress against your actual goals.
            </p>
            <p>
              And because the AI sees the whole picture, its analysis reflects
              your real situation, not one account in isolation. That&apos;s the
              difference between a stock tracker and true portfolio
              intelligence.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="bg-brand hover:bg-brand/90 dark:text-primary mt-8 rounded-lg px-6 text-base"
          >
            <Link href="/dashboard">Start tracking for free</Link>
          </Button>
        </div>
      </section>

      <section className="bg-muted/40 relative left-1/2 w-screen -translate-x-1/2 px-3 py-20 md:py-28">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">
            Your data stays yours
          </h2>
          <div className="text-muted-foreground mt-6 space-y-5 text-lg leading-8">
            <p>
              Money apps live or die on trust, so we believe you should be able
              to see how yours works. Foliofox is open source, which means our
              code can be inspected instead of hidden behind a black box. We use
              your financial data to power portfolio tracking and analysis, not
              to sell it, and our retention policy is designed to avoid keeping
              information longer than necessary. Foliofox never has access to
              move your money or make transactions. Your portfolio stays yours.
            </p>
            <p>
              Foliofox provides analysis and educational insights, not licensed
              investment advice. You stay in control of every decision.
            </p>
          </div>
        </div>
      </section>

      <HomepageTestimonials />

      <section className="border-t py-20 md:py-28">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">
            Frequently asked questions
          </h2>
          <Accordion type="single" collapsible className="mt-10">
            <AccordionItem value="what-is-foliofox">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                What is Foliofox?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                Foliofox is a free portfolio tracker with AI-powered financial
                planning built in. Import your stocks, ETFs, crypto and other
                assets, track performance with daily market updates, and get
                personalized analysis of your allocation, risk and goals.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="is-foliofox-free">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                Is Foliofox really free?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                Yes. The core portfolio tracker is free to use, with no trial
                countdown and no card required.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="supported-assets">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                What assets can I track with Foliofox?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                You can track stocks, ETFs, crypto, cash, real estate and more.
                Everything appears in one dashboard so you can see your complete
                net worth.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="import-portfolio">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                How do I import my portfolio?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                <p>
                  There are three ways to add your portfolio today, with bank
                  connections coming soon:
                </p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    <strong className="text-foreground">Broker import:</strong>{" "}
                    upload a supported Trade Republic, Scalable Capital or
                    Directa transaction export.
                  </li>
                  <li>
                    <strong className="text-foreground">CSV/AI upload:</strong>{" "}
                    upload positions or transaction history from a file or
                    screenshot.
                  </li>
                  <li>
                    <strong className="text-foreground">Manual entry:</strong>{" "}
                    add assets and transactions one by one for anything else.
                  </li>
                </ul>
                <p className="mt-4">
                  However you import, everything lands in one dashboard.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="foliofox-difference">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                What makes Foliofox different from other portfolio trackers?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                Most trackers stop at showing you numbers. Foliofox adds an AI
                layer that interprets them: it analyzes your specific holdings,
                flags concentration and risk, and helps you plan next steps.
                It&apos;s a portfolio tracker and an AI financial planner in one
                app.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="net-worth">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                Can Foliofox track my net worth?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                Yes. Because Foliofox consolidates your accounts and asset
                types, your dashboard doubles as a net worth tracker with daily
                market and exchange-rate updates.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="data-safety">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                Is my financial data safe with Foliofox?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                Foliofox is built around transparency. Our code is open source
                and available for anyone to inspect, we use your financial data
                only to provide tracking, analysis and insights rather than sell
                it, and our retention policy is designed to avoid keeping
                information longer than necessary. Foliofox can analyze the
                portfolio data you provide, but it never has access to move your
                money or make transactions.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="investment-advice">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                Does Foliofox give investment advice?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                Foliofox provides AI-powered analysis and educational planning
                insights. It is not a formally registered financial advisor and
                its output isn&apos;t licensed financial advice. It informs your
                decisions; it doesn&apos;t make them.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="performance-history">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                Can I see my portfolio&apos;s performance history?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                Yes. Foliofox charts your returns and net worth over time, so
                you can see how your investments have performed rather than
                relying on gut feel.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="mobile">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                Can I use Foliofox on mobile?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                Yes. Foliofox works in any modern mobile browser, with no app
                download required.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      <section className="border-y py-20 text-center md:py-28">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">
            Track your portfolio anywhere
          </h2>
          <p className="text-muted-foreground mt-5 text-lg leading-8">
            Foliofox runs in any browser, on desktop or mobile. Your portfolio,
            your insights and your plan, wherever you are.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-brand hover:bg-brand/90 dark:text-primary mt-8 rounded-lg px-6 text-base"
          >
            <Link href="/dashboard">Start tracking for free</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
