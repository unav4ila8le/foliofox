"use client";

import { useMemo, useState } from "react";
import { TriangleAlert, Info } from "lucide-react";

import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/custom/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/custom/dialog";

import { useDashboardData } from "@/components/dashboard/providers/dashboard-data-provider";
import { ArchivePositionDialog } from "@/components/dashboard/positions/shared/archive-dialog";
import { UpdateSymbolDialog } from "@/components/dashboard/positions/shared/update-symbol-dialog";

interface StaleBadgeProps {
  /** Position ID to check for staleness */
  positionId: string;
  label?: string;
}

export function StaleBadge({ positionId, label }: StaleBadgeProps) {
  const { marketDataStatuses } = useDashboardData();

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [updateSymbolDialogOpen, setUpdateSymbolDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  const marketDataStatus = useMemo(
    () => marketDataStatuses.find((status) => status.positionId === positionId),
    [marketDataStatuses, positionId],
  );

  if (!marketDataStatus) return null;

  const isUnavailable = marketDataStatus.status === "unavailable";
  const badgeLabel = isUnavailable ? "Market data unavailable" : label;

  const handleUpdateSymbolSuccess = () => {
    setStatusDialogOpen(false);
    setUpdateSymbolDialogOpen(false);
  };

  const badge = (
    <Badge
      asChild
      variant={isUnavailable ? "outline" : "default"}
      className={
        isUnavailable
          ? "text-muted-foreground hover:bg-muted cursor-pointer"
          : "cursor-pointer bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/15"
      }
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setStatusDialogOpen(true);
        }}
        aria-label={
          isUnavailable ? "Market data unavailable" : "Stale market data"
        }
      >
        {isUnavailable ? <Info /> : <TriangleAlert />}
        {badgeLabel && <span>{badgeLabel}</span>}
      </button>
    </Badge>
  );

  return (
    <>
      {isUnavailable ? (
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            Automatic market data is unavailable. Change the ticker if it moved,
            or archive the position if you no longer hold it.
          </TooltipContent>
        </Tooltip>
      ) : (
        badge
      )}

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isUnavailable
                ? `${marketDataStatus.ticker} market data is unavailable`
                : `${marketDataStatus.ticker} market data may be stale`}
            </DialogTitle>
            <DialogDescription>
              {isUnavailable
                ? "Foliofox no longer has an active Yahoo Finance ticker for this position."
                : "We haven't received fresh market data for this position in over 7 days."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {isUnavailable ? (
              <div className="space-y-4 text-sm">
                <p className="text-muted-foreground">
                  Foliofox will keep using the last available value and preserve
                  the position&apos;s history.
                </p>
                <Alert>
                  <Info className="size-4" />
                  <AlertTitle>Choose the appropriate next step</AlertTitle>
                  <AlertDescription>
                    Change the ticker if the security moved or was renamed. If
                    you no longer hold it, archive the position to remove it
                    from your active portfolio while preserving its history.
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium">What this means</h4>
                  <p className="text-muted-foreground">
                    Your position value is calculated using the last available
                    market data. If you noticed wrong prices/values, there may
                    be market data issues worth investigating.
                  </p>
                </div>

                <Alert>
                  <Info className="size-4" />
                  <AlertTitle>Possible causes</AlertTitle>
                  <AlertDescription>
                    <ul className="text-foreground list-inside list-disc space-y-1">
                      <li>
                        Temporary data feed issues from our data providers
                      </li>
                      <li>The ticker symbol may have changed</li>
                      <li>Extended market closures or trading halts</li>
                      <li>The security may have been delisted or merged</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <div>
                  <h4 className="font-medium">What we&apos;re doing</h4>
                  <p className="text-muted-foreground">
                    We automatically refresh market data daily. If this
                    persists, our systems will investigate and may reach out for
                    more details.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium">What you can do</h4>
                  <p className="text-muted-foreground">
                    If you suspect the ticker symbol has changed, you can update
                    it below. Otherwise, fresh data should arrive with our next
                    daily update.
                  </p>
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusDialogOpen(false)}
            >
              Close
            </Button>
            {isUnavailable && (
              <Button
                variant="outline"
                onClick={() => {
                  setStatusDialogOpen(false);
                  setArchiveDialogOpen(true);
                }}
              >
                Archive Position
              </Button>
            )}
            <Button
              onClick={() => {
                setStatusDialogOpen(false);
                setUpdateSymbolDialogOpen(true);
              }}
            >
              Change Ticker Symbol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UpdateSymbolDialog
        positionId={positionId}
        currentSymbolTicker={marketDataStatus.ticker}
        open={updateSymbolDialogOpen}
        onOpenChangeAction={setUpdateSymbolDialogOpen}
        onSuccess={handleUpdateSymbolSuccess}
      />

      <ArchivePositionDialog
        positions={[
          {
            id: marketDataStatus.positionId,
            name: marketDataStatus.positionName,
          },
        ]}
        open={archiveDialogOpen}
        onOpenChangeAction={setArchiveDialogOpen}
      />
    </>
  );
}
