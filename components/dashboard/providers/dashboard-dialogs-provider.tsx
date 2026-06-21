"use client";

import { ImportPositionsDialogProvider } from "@/components/dashboard/positions/import";
import { ImportPortfolioRecordsDialogProvider } from "@/components/dashboard/portfolio-records/import";
import { BrokerImportDialogProvider } from "@/components/dashboard/broker-import";
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
        <BrokerImportDialogProvider>
          <NewAssetDialogProvider>
            <NewPortfolioRecordDialogProvider>
              {children}
            </NewPortfolioRecordDialogProvider>
          </NewAssetDialogProvider>
        </BrokerImportDialogProvider>
      </ImportPortfolioRecordsDialogProvider>
    </ImportPositionsDialogProvider>
  );
}
