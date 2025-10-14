import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Header } from "@/components/homepage/header";
import { HeroImage } from "@/components/homepage/hero-image";

import { fetchOptionalProfile } from "@/server/profile/actions";

export default async function HomePage() {
  const data = await fetchOptionalProfile();

  return (
    <div className="from-muted to-background min-h-svh bg-gradient-to-b p-3">
      <div className="container mx-auto max-w-5xl">
        <Header profile={data?.profile} email={data?.email} />
      </div>
      <main className="container mx-auto mt-16 max-w-xl text-center">
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
          {data?.profile ? (
            <Link href="/dashboard">Dashboard</Link>
          ) : (
            <Link href="/auth/login">Get started</Link>
          )}
        </Button>
      </main>
      <div className="container mx-auto mt-12 mask-b-from-60%">
        <HeroImage priority={true} />
      </div>
    </div>
  );
}
