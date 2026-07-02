"use client";

import { ArrowDownCircle, ArrowUpCircle, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export function MarketBackedUpdateWarning() {
  return (
    <Alert className="bg-amber-500/10 text-amber-900 dark:text-amber-50">
      <TriangleAlert />
      <AlertTitle className="line-clamp-none">
        Portfolio performance may be approximate.
      </AlertTitle>
      <AlertDescription>
        <span>
          Prefer{" "}
          <Badge variant="outline">
            <ArrowUpCircle /> Buy
          </Badge>{" "}
          and{" "}
          <Badge variant="outline">
            <ArrowDownCircle /> Sell
          </Badge>{" "}
          records when possible.
          <br />
          Use Update records only when you need to reconcile holdings or adjust
          cost basis.
        </span>
      </AlertDescription>
    </Alert>
  );
}
