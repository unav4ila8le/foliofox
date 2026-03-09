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

import { exportPortfolioRecords } from "@/server/portfolio-records/export";
import { formatLocalDateKey } from "@/lib/date/date-utils";
import { downloadCsvFile } from "@/lib/export/shared/download-csv";

interface ExportPortfolioRecordsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordsCount?: number;
}

export function ExportPortfolioRecordsDialog({
  open,
  onOpenChange,
  recordsCount,
}: ExportPortfolioRecordsDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const todayDateKey = formatLocalDateKey(new Date());

  const handleExport = async () => {
    try {
      setIsLoading(true);

      const result = await exportPortfolioRecords();

      if (!result.success) {
        throw new Error(result.message || "Failed to export records");
      }

      downloadCsvFile({
        data: result.data,
        filename: `foliofox-records-${todayDateKey}.csv`,
      });

      toast.success("Records exported successfully!");
      onOpenChange(false);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to export records",
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
            Export Records
          </DialogTitle>
          <DialogDescription>
            Export your portfolio record history to a CSV file. This will
            include all records for your positions.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            <Alert>
              <Info className="size-4" />
              <AlertTitle>Export summary</AlertTitle>
              <AlertDescription>
                <ul className="list-inside list-disc text-sm">
                  <li>Position name and record type (buy/sell/update)</li>
                  <li>Record date, quantity, and unit value</li>
                  <li>Description and notes</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="text-sm">
              <span className="font-medium">File format:</span> CSV (Comma
              Separated Values)
              <br />
              <span className="font-medium">Filename:</span> foliofox-records-
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
                Export {recordsCount || 0} record(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
