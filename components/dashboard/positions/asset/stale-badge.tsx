"use client";

import { useMemo, useState } from "react";
import { TriangleAlert, Info } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

import { useDashboardData } from "@/components/dashboard/dashboard-data-provider";
import { UpdateSymbolDialog } from "@/components/dashboard/positions/shared/update-symbol-dialog";

interface StaleBadgeProps {
  /** Position ID to check for staleness */
  positionId: string;
  label?: string;
}

export function StaleBadge({ positionId, label }: StaleBadgeProps) {
  const { stalePositions } = useDashboardData();

  const [updateSymbolDialogOpen, setUpdateSymbolDialogOpen] = useState(false);

  const stalePosition = useMemo(
    () => stalePositions.find((sp) => sp.positionId === positionId),
    [stalePositions, positionId],
  );

  if (!stalePosition) return null;

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Badge
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="cursor-pointer bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/15"
          >
            <TriangleAlert aria-label="Stale market data" />
            {label && <span>{label}</span>}
          </Badge>
        </DialogTrigger>
        <DialogContent
          // TO FIX: clicking outside of the dialog fires row actions
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="max-h-[calc(100dvh-1rem)] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>
              {stalePosition.ticker} market data may be stale
            </DialogTitle>
            <DialogDescription>
              We haven&apos;t received fresh market data for this position in
              over 7 days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium">What this means</h4>
              <p className="text-muted-foreground">
                Your position value is calculated using the last available
                market data. If you noticed wrong prices/values, there may be
                market data issues worth investigating.
              </p>
            </div>

            <Alert>
              <Info className="size-4" />
              <AlertTitle>Possible causes</AlertTitle>
              <AlertDescription>
                <ul className="text-foreground list-inside list-disc space-y-1">
                  <li>Temporary data feed issues from our data providers</li>
                  <li>The ticker symbol may have changed</li>
                  <li>Extended market closures or trading halts</li>
                  <li>The security may have been delisted or merged</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div>
              <h4 className="font-medium">What we&apos;re doing</h4>
              <p className="text-muted-foreground">
                We automatically refresh market data daily. If this persists,
                our systems will investigate and may reach out for more details.
              </p>
            </div>

            <div>
              <h4 className="font-medium">What you can do</h4>
              <p className="text-muted-foreground">
                If you suspect the ticker symbol has changed, you can update it
                below. Otherwise, fresh data should arrive with our next daily
                update.
              </p>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
            <Button onClick={() => setUpdateSymbolDialogOpen(true)}>
              Change Ticker Symbol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UpdateSymbolDialog
        positionId={positionId}
        currentSymbolTicker={stalePosition.ticker}
        open={updateSymbolDialogOpen}
        onOpenChangeAction={setUpdateSymbolDialogOpen}
      />
    </>
  );
}
