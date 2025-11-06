import { Header } from "@/components/homepage/header";
import { Hero } from "@/components/homepage/hero";

import { fetchOptionalProfile } from "@/server/profile/actions";

export default async function HomePage() {
  const data = await fetchOptionalProfile();

  return (
    <div className="from-muted to-background min-h-svh bg-linear-to-b p-3">
      <div className="container mx-auto max-w-5xl">
        <Header profile={data?.profile} email={data?.email} />
        <main className="mt-16">
          <Hero profile={data?.profile} />
        </main>
      </div>
    </div>
  );
}
