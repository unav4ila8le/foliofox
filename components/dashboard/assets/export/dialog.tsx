"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Download, LoaderCircle, FileText, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { exportHoldings } from "@/server/holdings/export";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holdingsCount?: number;
}

export function ExportDialog({
  open,
  onOpenChange,
  holdingsCount,
}: ExportDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    try {
      setIsLoading(true);

      const result = await exportHoldings();

      if (!result.success) {
        throw new Error(result.message || "Failed to export holdings");
      }

      // Create and download the file
      const blob = new Blob([result.data!], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      // Create temporary link and trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = `patrivio-holdings-${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();

      // Cleanup temporary link
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Holdings exported successfully!");
      onOpenChange(false);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to export holdings",
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
            Export Holdings
          </DialogTitle>
          <DialogDescription>
            Export your current holdings to a CSV file. This will include all
            active holdings with their current market values and quantities.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Info className="size-4" />
            <AlertTitle>Export summary</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc text-sm">
                <li>Holding name, category, and currency</li>
                <li>Current quantity and market value</li>
                <li>Symbol information (if applicable)</li>
                <li>Description and notes</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="text-sm">
            <span className="font-medium">File format:</span> CSV (Comma
            Separated Values)
            <br />
            <span className="font-medium">Filename:</span> patrivio-holdings-
            {format(new Date(), "yyyy-MM-dd")}.csv
          </div>
        </div>

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
                <LoaderCircle className="size-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="size-4" />
                Export {holdingsCount || 0} holding(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
