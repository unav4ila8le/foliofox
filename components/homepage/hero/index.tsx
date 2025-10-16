import Link from "next/link";

import { Button } from "@/components/ui/button";

import { HeroImage } from "./image";

import type { Profile } from "@/types/global.types";

export function Hero({ profile }: { profile?: Profile }) {
  return (
    <section>
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-5xl tracking-tight text-balance md:text-6xl">
          Meet Your Personal Financial Advisor
        </h1>
        <p className="text-foreground/80 mt-4 text-lg">
          Your AI-powered financial advisor that helps you make smarter
          decisions about your money.
        </p>
        <Button
          asChild
          size="lg"
          className="bg-brand hover:bg-brand/90 mt-8 h-11 rounded-lg px-8 text-base"
        >
          {profile ? (
            <Link href="/dashboard">Dashboard</Link>
          ) : (
            <Link href="/auth/login">Get started</Link>
          )}
        </Button>
      </div>
      <div className="mt-12 mask-b-from-60%">
        <HeroImage priority={true} />
      </div>
    </section>
  );
}
