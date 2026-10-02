import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { HeroImage } from "@/components/homepage/hero/image";

import financialProfileImage from "@/public/images/changelog/2025-11/financial-profile.jpg";
import scenarioPlanningImage from "@/public/images/changelog/2025-12/scenario-planning.jpg";
import performanceChartImage from "@/public/images/homepage/ai-financial-planning-performance.png";
import fwaszAvatar from "@/public/images/testimonials/fwasz-avatar.png";
import nathanAvatar from "@/public/images/testimonials/nathan-avatar.png";
import sandyAvatar from "@/public/images/testimonials/sandy-avatar.jpg";

export const metadata: Metadata = {
  title: {
    absolute: "AI Financial Planner | Free AI Financial Planning Tool",
  },
  description:
    "Meet the AI financial planner that knows your actual portfolio. Free AI powered financial planning: analyze your investments, plan your goals, act with confidence.",
  alternates: {
    canonical: "/ai-financial-planning",
  },
};

export default function AiFinancialPlanningPage() {
  return (
    <div className="mx-auto max-w-7xl px-3 pt-16 md:pt-24">
      <section>
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-brand text-sm font-semibold">
            Introducing FolioFox AI
          </p>
          <h1 className="mt-4 text-4xl tracking-tight text-balance sm:text-5xl md:text-6xl">
            Looking for an AI financial advisor?
          </h1>
          <p className="text-foreground/80 mx-auto mt-6 max-w-3xl text-lg leading-8">
            Generic chatbots give generic advice. FolioFox is an AI financial
            planning tool connected to your real portfolio, so every insight
            reflects your actual holdings, allocation and goals. Ask questions,
            stress test your plan, and get clear, personalized analysis of your
            money that used to cost an advisor&apos;s time, free.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-brand hover:bg-brand/90 dark:text-primary mt-8 rounded-lg px-6 text-base"
          >
            <Link href="/dashboard">Try FolioFox free</Link>
          </Button>
        </div>

        <div className="mt-12 mask-b-from-60%">
          <HeroImage alt="FolioFox AI financial planner analyzing an investment portfolio" />
        </div>
      </section>

      <section className="border-t py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">
            The AI financial planner that knows your money
          </h2>
          <p className="text-muted-foreground mt-4 text-lg leading-8">
            What makes FolioFox different from asking ChatGPT about your money?
            Context. Here&apos;s what that unlocks.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="border-l-brand/70 rounded-r-lg border-l-2 p-6">
            <h3 className="text-xl font-semibold">
              Grounded in your portfolio
            </h3>
            <p className="text-muted-foreground mt-3 leading-7">
              ChatGPT has never seen your accounts. FolioFox has. Our AI
              financial planner reads your actual holdings before it says a
              word, so its analysis is specific to you, not a rewritten
              Wikipedia page.
            </p>
          </div>
          <div className="border-l-brand/70 rounded-r-lg border-l-2 p-6">
            <h3 className="text-xl font-semibold">
              Planning, not just tracking
            </h3>
            <p className="text-muted-foreground mt-3 leading-7">
              Set goals, model scenarios and understand tradeoffs. FolioFox
              turns portfolio data into a financial plan you can act on:
              retirement, big purchases, what if scenarios, and beyond.
            </p>
          </div>
          <div className="border-l-brand/70 rounded-r-lg border-l-2 p-6">
            <h3 className="text-xl font-semibold">
              Always available, a fraction of the cost
            </h3>
            <p className="text-muted-foreground mt-3 leading-7">
              Professional grade financial planning has always been gated behind
              advisor fees that run thousands per year. FolioFox has your
              portfolio memorized and answers 24/7, whenever you&apos;re
              thinking about your money.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-muted/40 relative left-1/2 w-screen -translate-x-1/2 py-20 md:py-28">
        <div className="mx-auto max-w-7xl space-y-20 px-3 md:space-y-28">
          <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
            <div className="max-w-lg">
              <p className="text-brand text-sm font-semibold">Step 1</p>
              <h3 className="mt-3 text-2xl font-semibold">
                Connect your portfolio
              </h3>
              <p className="text-muted-foreground mt-4 leading-7">
                Import your investments so the AI has the full picture: every
                account, every asset, your complete net worth.
              </p>
            </div>
            <div className="relative aspect-[1080/666] overflow-hidden rounded-lg">
              <Image
                fill
                src={performanceChartImage}
                alt="FolioFox portfolio rate of return performance chart"
                className="object-cover"
                sizes="(min-width: 768px) 50vw, 100vw"
              />
            </div>
          </div>

          <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
            <div className="max-w-lg md:order-2">
              <p className="text-brand text-sm font-semibold">Step 2</p>
              <h3 className="mt-3 text-2xl font-semibold">Set your goals</h3>
              <p className="text-muted-foreground mt-4 leading-7">
                Retirement, a home, financial independence, or simply beating
                your benchmark. Tell FolioFox what you&apos;re working toward.
              </p>
            </div>
            <div className="relative aspect-[1080/666] overflow-hidden rounded-lg md:order-1">
              <Image
                fill
                src={financialProfileImage}
                alt="Setting financial goals and preferences in FolioFox"
                className="object-cover"
                sizes="(min-width: 768px) 50vw, 100vw"
              />
            </div>
          </div>

          <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
            <div className="max-w-lg">
              <p className="text-brand text-sm font-semibold">Step 3</p>
              <h3 className="mt-3 text-2xl font-semibold">
                Plan with Foliofox
              </h3>
              <p className="text-muted-foreground mt-4 leading-7">
                Ask anything about your finances and get answers grounded in
                your data. Risk checks, progress checks, scenario answers: your
                plan evolves as your portfolio does.
              </p>
            </div>
            <div className="relative aspect-[1080/666] overflow-hidden rounded-lg">
              <Image
                fill
                src={scenarioPlanningImage}
                alt="A financial plan and scenario modeled in FolioFox"
                className="object-cover"
                sizes="(min-width: 768px) 50vw, 100vw"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">
            AI financial planner vs human advisor: an honest comparison
          </h2>
          <div className="text-muted-foreground mt-6 space-y-5 text-lg leading-8">
            <p>
              A good human financial planner is worth a lot. They&apos;re also
              expensive (typically 1% of assets per year or thousands in flat
              fees) and out of reach for most people.
            </p>
            <p>
              An AI financial planner like FolioFox isn&apos;t a formally
              licensed financial planner, and we won&apos;t pretend otherwise.
              What it offers instead: it&apos;s available at 2am, it never has a
              product to sell you, it has actually read every position in your
              portfolio, and it costs nothing to get started.
            </p>
            <p>
              For many investors the right answer is both: use FolioFox to
              understand your finances deeply and continuously, and bring
              sharper questions to a professional when the stakes call for one.
              For everyone who was never going to hire an advisor at all,
              FolioFox is an upgrade from guessing.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="bg-brand hover:bg-brand/90 dark:text-primary mt-8 rounded-lg px-6 text-base"
          >
            <Link href="/dashboard">Start planning free</Link>
          </Button>
        </div>
      </section>

      <section className="bg-muted/40 relative left-1/2 w-screen -translate-x-1/2 px-3 py-20 md:py-28">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">
            Built on trust
          </h2>
          <p className="text-muted-foreground mt-6 text-lg leading-8">
            Financial planning starts with trust, and we believe transparency is
            part of earning it. Foliofox is open source, so our code can be
            inspected rather than hidden behind a black box. We use your
            financial data to power your experience, not to sell it, and follow
            a clear data retention policy designed to avoid keeping information
            longer than necessary. Foliofox can analyze your portfolio, but it
            never has access to move your money or make transactions. Your data
            informs the insights; the decisions always stay with you.
          </p>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <h2 className="text-3xl tracking-tight text-balance md:text-4xl">
          What investors say about Foliofox
        </h2>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          <blockquote className="flex flex-col border-l pl-5">
            <p className="text-lg leading-8 italic">
              FolioFox helped my husband and I feel much more confident about
              our plans for retirement. Having everything laid out gives us real
              peace of mind.
            </p>
            <footer className="text-muted-foreground mt-auto flex items-center gap-2 pt-4 text-sm font-medium">
              <Image
                src={sandyAvatar}
                alt=""
                className="ring-border size-8 rounded-full object-cover ring-1"
              />
              <span>Sandy</span>
            </footer>
          </blockquote>
          <blockquote className="flex flex-col border-l pl-5">
            <p className="flex flex-1 items-center text-lg leading-8 italic">
              Foliofox has been a lifesaver in helping me reach my investment
              goals.
            </p>
            <footer className="text-muted-foreground mt-auto flex items-center gap-2 pt-4 text-sm font-medium">
              <Image
                src={fwaszAvatar}
                alt=""
                className="ring-border size-8 rounded-full object-cover ring-1"
              />
              <span>Fwasz</span>
            </footer>
          </blockquote>
          <blockquote className="flex flex-col border-l pl-5">
            <p className="text-lg leading-8 italic">
              FolioFox has made it extremely easy to monitor investments,
              understand where I stand towards my financial goals, and get
              advice in one place.
            </p>
            <footer className="text-muted-foreground mt-auto flex items-center gap-2 pt-4 text-sm font-medium">
              <Image
                src={nathanAvatar}
                alt=""
                className="ring-border size-8 rounded-full object-cover ring-1"
              />
              <span>Nathan, CPA</span>
            </footer>
          </blockquote>
        </div>
      </section>

      <section className="border-t py-20 md:py-28">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">
            Frequently asked questions
          </h2>
          <Accordion type="single" collapsible className="mt-10">
            <AccordionItem value="what-is-ai-financial-planner">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                What is an AI financial planner?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                An AI financial planner is software that uses artificial
                intelligence to analyze your finances and help you plan:
                allocation, risk, goals and next steps. FolioFox connects this
                AI directly to your tracked portfolio, so the guidance reflects
                your real situation.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="is-ai-planner-free">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                Is FolioFox&apos;s AI financial planner free?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                Yes. You can track your portfolio and use AI planning features
                for free.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="replace-financial-advisor">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                Can AI replace a financial advisor?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                Not fully, and FolioFox doesn&apos;t claim to. AI excels at
                continuous, data-grounded analysis of your specific portfolio at
                zero cost. Qualified human advisors can add licensed, fiduciary
                judgment for complex situations. Many people use FolioFox as
                their everyday financial thinking partner and consult a
                professional for major decisions; others use it as their only
                planning tool because hiring an advisor was never on the table.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="different-from-chatgpt">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                How is this different from asking ChatGPT about my finances?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                General chatbots give general answers because they can&apos;t
                see your accounts. FolioFox&apos;s AI is connected to your
                actual portfolio, so when you ask “am I too concentrated?” it
                answers about your holdings, with numbers.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="data-safety">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                Is my financial data safe?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                Foliofox is built around transparency. Our code is open source
                and available for anyone to inspect, we use your financial data
                only to power your experience rather than sell it, and our
                retention policy is designed to avoid keeping information longer
                than necessary. Foliofox can analyze the portfolio data you
                provide, but it never has access to move your money or make
                transactions.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="personalized-advice">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                Does FolioFox give personalized investment advice?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                FolioFox provides AI-powered analysis and educational planning
                insights. It is not a formally registered financial advisor and
                its output isn&apos;t licensed financial advice. It informs your
                decisions; it doesn&apos;t make them.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="what-can-i-ask">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                What can I ask the AI financial planner?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                Anything about your finances: whether your allocation matches
                your risk tolerance, how concentrated you are, whether
                you&apos;re on track for a goal, how far your mix has drifted
                from your target, or simply what&apos;s going on in your
                portfolio this month.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="retirement-planning">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                Can FolioFox help me plan for retirement?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                Yes. Set retirement as a goal and FolioFox helps you track
                progress and understand whether your current portfolio and
                contributions support the timeline you want.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="investing-experience">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                Do I need investing experience to use it?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                No. FolioFox explains your finances in plain language, which
                makes it especially useful for people who find money opaque.
                Experienced investors use it to pressure test their own
                thinking.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="accuracy">
              <AccordionTrigger className="py-5 text-base hover:no-underline">
                How accurate is AI financial planning?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-7">
                FolioFox works from your real data, which makes it more relevant
                than generic AI advice. No model is perfect, though; treat the
                AI as a well-informed second opinion and verify before major
                moves.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      <section className="border-y py-20 text-center md:py-28">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl tracking-tight text-balance md:text-4xl">
            Build a plan around your real portfolio
          </h2>
          <p className="text-muted-foreground mt-5 text-lg leading-8">
            Bring your investments, goals and questions together. Get
            personalized analysis grounded in your financial picture, free to
            start.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-brand hover:bg-brand/90 dark:text-primary mt-8 rounded-lg px-6 text-base"
          >
            <Link href="/dashboard">Start planning free</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
