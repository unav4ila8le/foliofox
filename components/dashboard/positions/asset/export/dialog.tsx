"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Download, FileText, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { exportPositions } from "@/server/positions/export";

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

  const handleExport = async () => {
    try {
      setIsLoading(true);

      const result = await exportPositions("asset");

      if (!result.success) {
        throw new Error(result.message || "Failed to export assets");
      }

      // Create and download the file
      const blob = new Blob([result.data!], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      // Create temporary link and trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = `foliofox-assets-${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();

      // Cleanup temporary link
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

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
