import { Header } from "@/components/homepage/header";
import { Hero } from "@/components/homepage/hero";

export default function HomePage() {
  return (
    <div className="from-muted to-background min-h-svh bg-linear-to-b p-3">
      <div className="container mx-auto max-w-5xl">
        <Header />
        <main className="mt-16">
          <Hero />
        </main>
      </div>
    </div>
  );
}
