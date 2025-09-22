import { ArrowLeftRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { TransactionsTable } from "@/components/dashboard/holdings/tables/transactions/transactions-table";

import type { TransactionWithHolding } from "@/types/global.types";

interface TransactionsWidgetProps {
  transactionsData: TransactionWithHolding[];
}

export function TransactionsWidget({
  transactionsData,
}: TransactionsWidgetProps) {
  // Handle empty state
  if (!transactionsData || transactionsData.length === 0) {
    return (
      <Card className="flex h-80 flex-col gap-4">
        <CardContent className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="bg-accent rounded-lg p-2">
            <ArrowLeftRight className="text-muted-foreground size-4" />
          </div>
          <p className="mt-3 font-medium">Portfolio Transactions</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Add a new record to start tracking your portfolio transactions
          </p>
        </CardContent>
      </Card>
    );
  }

  // Display transactions
  return <TransactionsTable data={transactionsData} showHoldingColumn />;
}
