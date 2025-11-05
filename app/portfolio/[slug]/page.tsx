import { notFound } from "next/navigation";
import Link from "next/link";

import { Logomark } from "@/components/ui/logos/logomark";
import { PublicPortfolioHeader } from "@/components/public-portfolio/header";
import { PublicPortfolioAssetsTable } from "@/components/public-portfolio/assets-table";
import { AssetAllocationDonutPublic } from "@/components/dashboard/charts/asset-allocation-donut";
import { ProjectedIncomeWidget } from "@/components/dashboard/charts/projected-income/widget";

import { buildPublicPortfolioView } from "@/server/public-portfolios/view";

export default async function PublicPortfolioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ currency?: string | string[] }>;
}) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const rawCurrency = Array.isArray(search?.currency)
    ? search?.currency[0]
    : search?.currency;
  const portfolio = await buildPublicPortfolioView(slug, rawCurrency);

  if (!portfolio) {
    notFound();
  }

  if (portfolio.status === "expired") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Link href="/" aria-label="Foliofox - Go to homepage">
          <Logomark
            height={80}
            className="text-muted-foreground/30 hover:text-brand transition-colors"
          />
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Link expired</h1>
        <p className="text-muted-foreground mt-2">
          This shared portfolio link has expired.
          <br />
          Ask the owner to refresh or re-enable public sharing to view the
          latest data.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 grid w-full grid-cols-6 gap-4">
      <div className="col-span-6">
        <PublicPortfolioHeader
          username={portfolio.owner.username}
          avatarUrl={portfolio.owner.avatarUrl}
          currentCurrency={portfolio.netWorth.currency}
          defaultCurrency={portfolio.owner.displayCurrency}
        />
      </div>
      <div className="col-span-6 md:col-span-3">
        <AssetAllocationDonutPublic
          netWorth={portfolio.netWorth.value}
          currency={portfolio.netWorth.currency}
          assetAllocation={portfolio.assetAllocation}
          className="h-72! rounded-lg shadow-none"
        />
      </div>
      <div className="col-span-6 md:col-span-3">
        <ProjectedIncomeWidget
          projectedIncome={{
            success: portfolio.projectedIncome.success,
            data: portfolio.projectedIncome.data,
            message: portfolio.projectedIncome.message,
            currency: portfolio.projectedIncome.currency,
          }}
          currency={portfolio.projectedIncome.currency}
          className="h-72! rounded-lg shadow-none"
        />
      </div>
      <div className="col-span-6">
        <PublicPortfolioAssetsTable positions={portfolio.positions} />
      </div>
    </div>
  );
}
