import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { Hero } from "@/components/homepage/hero";
import { HomepageFeatures } from "@/components/homepage/features";
import { HomepageTestimonials } from "@/components/homepage/testimonials";

export default function HomePage() {
  return (
    <div className="relative mx-auto mt-12 max-w-7xl p-3">
      <Hero />
      <HomepageFeatures />

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">
            Know you&apos;re on track
          </h2>
          <p className="text-muted-foreground mt-6 text-lg leading-8">
            Everyone has the same quiet question: am I going to be okay?
            Foliofox answers it with your real numbers. See where you stand
            today, where you&apos;re headed, and whether it adds up to the goals
            you&apos;ve set. Check once, or check every morning. The answer is
            always current.
          </p>
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
                Foliofox is a portfolio tracker with AI powered financial
                planning built in. Import your investments, see your full net
                worth, and get analysis specific to your holdings, risks and
                goals.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="is-foliofox-free">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                Is Foliofox free?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                Yes. The core tracker is free, no card required. You can import
                your portfolio and get a clear picture of your money in minutes.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="data-safety">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                Is my financial data safe?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                Foliofox uses your financial data to provide tracking, analysis
                and insights, never to sell it. It never has access to move your
                money or make transactions. Our code is open source, so how we
                handle your information can be inspected rather than taken on
                faith.
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
          </Accordion>
        </div>
      </section>

      <section className="border-t py-20 text-center md:py-28">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">
            Get a clearer picture of your financial life
          </h2>
          <p className="text-muted-foreground mt-5 text-lg leading-8">
            Bring your investments together, understand your money, and plan
            your next step with confidence. Free to start, no card required.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-brand hover:bg-brand/90 dark:text-primary mt-8 rounded-lg px-6 text-base"
          >
            <Link href="/dashboard">Get started free</Link>
          </Button>
        </div>
      </section>

      {/* BMC Button */}
      <Link
        href="https://buymeacoffee.com/leonardofromfoliofox"
        target="_blank"
        className="fixed right-4 bottom-6 transition-all duration-100 hover:scale-105 md:right-8 md:bottom-8"
      >
        <Image
          src="/images/homepage/bmc-button.svg"
          alt="Buy me a Coffee"
          width={164}
          height={46}
        />
      </Link>
    </div>
  );
}
