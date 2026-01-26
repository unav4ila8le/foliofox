import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { PortfolioRecordsTable } from "@/components/dashboard/portfolio-records/table/portfolio-records-table";
import { NewPortfolioRecordButton } from "@/components/dashboard/new-portfolio-record";
import { ImportPortfolioRecordsButton } from "@/components/dashboard/portfolio-records/import";

import type { PortfolioRecordWithPosition } from "@/types/global.types";

interface PortfolioRecordsWidgetProps {
  portfolioRecordsData: PortfolioRecordWithPosition[];
  hasPositions: boolean;
}

export function PortfolioRecordsWidget({
  portfolioRecordsData,
  hasPositions,
}: PortfolioRecordsWidgetProps) {
  // Handle empty state
  if (!portfolioRecordsData || portfolioRecordsData.length === 0) {
    return (
      <Card className="flex h-80 flex-col gap-4 rounded-lg shadow-xs">
        <CardContent className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="bg-accent rounded-lg p-2">
            <ArrowLeftRight className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">Portfolio Records</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Add a new record to start tracking your portfolio
          </p>
          {hasPositions && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <NewPortfolioRecordButton variant="outline" />
              <ImportPortfolioRecordsButton variant="outline" />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Display portfolio records
  return (
    <div className="space-y-3">
      <PortfolioRecordsTable
        data={portfolioRecordsData}
        showPositionColumn
        readOnly
        enableSearch={false}
      />
      <div className="flex justify-end">
        <Button asChild variant="link" className="h-auto p-0">
          <Link href="/dashboard/portfolio-records">View all</Link>
        </Button>
      </div>
    </div>
  );
}
