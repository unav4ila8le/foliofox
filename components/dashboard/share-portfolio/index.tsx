import { SharePortfolioButtonClient } from "./share-portfolio-button-client";
import { fetchCurrentPublicPortfolio } from "@/server/public-portfolios/fetch";

export async function SharePortfolioButton() {
  const shareMetadata = await fetchCurrentPublicPortfolio();
  return <SharePortfolioButtonClient initialShareMetadata={shareMetadata} />;
}
