import { Header } from "@/components/homepage/header";

export default async function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col p-3">
      <div className="container mx-auto flex max-w-5xl flex-1 flex-col">
        <Header cta="Try Foliofox" />
        <main className="mt-2 flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
