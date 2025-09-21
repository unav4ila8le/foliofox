"use client";

import { useState, useCallback, useEffect } from "react";
import { Upload, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileUploadDropzone } from "@/components/ui/file-upload-dropzone";
import { ImportResults } from "./import-results";
import { useImportHoldingsDialog } from "./index";

import { useAssetCategories } from "@/hooks/use-asset-categories";
import { parseHoldingsCSV } from "@/lib/import/sources/csv";
import { importHoldings } from "@/server/holdings/import";

import type { ImportResult } from "@/lib/import/types";

export function CSVImportForm() {
  const { setOpen, open, setReviewOpen, setReviewHoldings } =
    useImportHoldingsDialog();
  const { categories } = useAssetCategories();

  // State for the entire import flow
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ImportResult | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");

  // Handle file drop/selection and immediate parsing
  const handleFileSelect = useCallback(async (file: File, content: string) => {
    setSelectedFile(file);
    setParseResult(null);
    setIsProcessing(true);
    setCsvContent(content);

    try {
      const result = await parseHoldingsCSV(content);
      setParseResult(result);
    } catch (error) {
      console.error("Error parsing CSV:", error);
      setParseResult({
        success: false,
        holdings: [],
        errors: ["Failed to parse CSV. Please try again."],
      });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handle final import
  const handleImport = async () => {
    if (!csvContent) return;

    setIsImporting(true);
    try {
      const result = await importHoldings(csvContent);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success(`Successfully imported ${result.importedCount} holdings!`);
      setOpen(false);
    } catch (error) {
      console.error("Import error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to import holdings",
      );
    } finally {
      setIsImporting(false);
    }
  };

  // Handler for reviewing the import
  const handleReview = () => {
    if (!parseResult) return;
    setReviewHoldings(parseResult.holdings);
    setReviewOpen(true);
  };

  // Handler for resetting the form
  const handleReset = () => {
    setSelectedFile(null);
    setParseResult(null);
    setCsvContent("");
  };

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      handleReset();
    }
  }, [open]);

  return (
    <div className="space-y-4">
      <div className="text-muted-foreground space-y-2 text-sm">
        <p>
          Upload a CSV or TSV file to import your holdings. The first row should
          contain the headers below.
        </p>
        <p>
          <span className="text-foreground font-medium">Required columns:</span>{" "}
          name, currency, quantity,{" "}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-foreground inline-block cursor-help underline-offset-4 hover:underline">
                unit_value
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Unit Value is required unless symbol_id is present. For holdings
              with symbol_id, the unit value will be fetched from the market.
            </TooltipContent>
          </Tooltip>
          .
        </p>
        <p>
          <span className="text-foreground font-medium">Optional columns:</span>{" "}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-foreground inline-block cursor-help underline-offset-4 hover:underline">
                category_code
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Available categories:{" "}
              {categories.map((category) => category.code).join(", ")}
            </TooltipContent>
          </Tooltip>
          , cost_basis_per_unit,{" "}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-foreground inline-block cursor-help underline-offset-4 hover:underline">
                symbol_id
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Use Yahoo Finance ticker symbols (e.g., AAPL, MSFT, VWCE.DE).
            </TooltipContent>
          </Tooltip>
          , description.
        </p>
      </div>

      {/* Dropzone Section */}
      <FileUploadDropzone
        accept={{
          "text/csv": [".csv"],
          "text/tab-separated-values": [".tsv"],
          "text/plain": [".csv", ".tsv"],
          "application/vnd.ms-excel": [".csv"],
        }}
        maxSize={5 * 1024 * 1024} // 5MB for CSV files
        onFileSelect={handleFileSelect}
        selectedFile={selectedFile}
        isProcessing={isProcessing}
        onReset={handleReset}
        disabled={isImporting}
        title="Drop your CSV file here"
      />

      {/* Parse results */}
      {parseResult && !isProcessing && <ImportResults result={parseResult} />}

      {/* Help text */}
      <div className="text-muted-foreground text-sm">
        Need help? Download a{" "}
        <a
          href="/sample-holdings-template.csv"
          download
          className="text-primary underline-offset-4 hover:underline"
        >
          sample template
        </a>{" "}
        or export your existing holdings to see the correct format.
      </div>

      {/* Footer - Action buttons */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={isProcessing || isImporting}
        >
          Cancel
        </Button>

        {parseResult && !parseResult.success && !isProcessing && (
          <Button onClick={handleReview}>Review Errors</Button>
        )}

        {parseResult?.success && !isProcessing && (
          <>
            <Button
              variant="outline"
              onClick={handleReview}
              disabled={isImporting}
            >
              Review Import
            </Button>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  Import {parseResult.holdings?.length} holding(s)
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
