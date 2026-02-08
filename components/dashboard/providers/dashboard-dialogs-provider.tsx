"use client";

import { ImportPositionsDialogProvider } from "@/components/dashboard/positions/import";
import { ImportPortfolioRecordsDialogProvider } from "@/components/dashboard/portfolio-records/import";
import { NewAssetDialogProvider } from "@/components/dashboard/new-asset";
import { NewPortfolioRecordDialogProvider } from "@/components/dashboard/new-portfolio-record";

export function DashboardDialogsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ImportPositionsDialogProvider>
      <ImportPortfolioRecordsDialogProvider>
        <NewAssetDialogProvider>
          <NewPortfolioRecordDialogProvider>
            {children}
          </NewPortfolioRecordDialogProvider>
        </NewAssetDialogProvider>
      </ImportPortfolioRecordsDialogProvider>
    </ImportPositionsDialogProvider>
  );
}
