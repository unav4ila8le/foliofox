import { Header } from "@/components/homepage/header";

import { fetchOptionalProfile } from "@/server/profile/actions";

export default async function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await fetchOptionalProfile();

  return (
    <div className="flex min-h-svh flex-col p-3">
      <div className="container mx-auto flex max-w-5xl flex-1 flex-col">
        <Header profile={data?.profile} email={data?.email} />
        <main className="mt-2 flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
