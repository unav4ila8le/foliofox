"use client";

import { useState } from "react";
import { Download, FileText, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/custom/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { exportPositions } from "@/server/positions/export";
import { formatLocalDateKey } from "@/lib/date/date-utils";
import { downloadCsvFile } from "@/lib/export/shared/download-csv";

interface ExportAssetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positionsCount?: number;
}

export function ExportAssetsDialog({
  open,
  onOpenChange,
  positionsCount,
}: ExportAssetsDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const todayDateKey = formatLocalDateKey(new Date());

  const handleExport = async () => {
    try {
      setIsLoading(true);

      const result = await exportPositions("asset");

      if (!result.success) {
        throw new Error(result.message || "Failed to export assets");
      }

      downloadCsvFile({
        data: result.data,
        filename: `foliofox-assets-${todayDateKey}.csv`,
      });

      toast.success("Assets exported successfully!");
      onOpenChange(false);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to export assets",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Export Assets
          </DialogTitle>
          <DialogDescription>
            Export your current assets to a CSV file. This will include all
            active assets with their current market values and quantities.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            <Alert>
              <Info className="size-4" />
              <AlertTitle>Export summary</AlertTitle>
              <AlertDescription>
                <ul className="list-inside list-disc text-sm">
                  <li>Asset name, category, and currency</li>
                  <li>Current quantity and market value</li>
                  <li>Cost basis and profit/loss (if applicable)</li>
                  <li>Market data information (if applicable)</li>
                  <li>Description and notes</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="text-sm">
              <span className="font-medium">File format:</span> CSV (Comma
              Separated Values)
              <br />
              <span className="font-medium">Filename:</span> foliofox-assets-
              {todayDateKey}.csv
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isLoading}>
            {isLoading ? (
              <>
                <Spinner />
                Exporting...
              </>
            ) : (
              <>
                <Download className="size-4" />
                Export {positionsCount || 0} asset(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
