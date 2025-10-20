import { ArrowLeftRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { PortfolioRecordsTable } from "@/components/dashboard/portfolio-records/table/portfolio-records-table";

import type { PortfolioRecordWithPosition } from "@/types/global.types";

interface PortfolioRecordsWidgetProps {
  portfolioRecordsData: PortfolioRecordWithPosition[];
}

export function PortfolioRecordsWidget({
  portfolioRecordsData,
}: PortfolioRecordsWidgetProps) {
  // Handle empty state
  if (!portfolioRecordsData || portfolioRecordsData.length === 0) {
    return (
      <Card className="flex h-80 flex-col gap-4">
        <CardContent className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="bg-accent rounded-lg p-2">
            <ArrowLeftRight className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">Portfolio Records</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Add a new record to start tracking your portfolio
          </p>
        </CardContent>
      </Card>
    );
  }

  // Display portfolio records
  return (
    <PortfolioRecordsTable data={portfolioRecordsData} showPositionColumn />
  );
}
