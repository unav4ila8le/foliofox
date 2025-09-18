"use client";

import { useState, useCallback, useEffect } from "react";
import { Upload, AlertCircle, CheckCircle, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileUploadDropzone } from "@/components/ui/file-upload-dropzone";
import { useImportHoldingsDialog } from "./index";

import { useAssetCategories } from "@/hooks/use-asset-categories";
import { parseHoldingsCSV } from "@/lib/csv-parser/index";
import { importHoldings } from "@/server/holdings/import";

type ParseResult = Awaited<ReturnType<typeof parseHoldingsCSV>>;

export function CSVImportForm() {
  const { setOpen, open } = useImportHoldingsDialog();
  const { categories } = useAssetCategories();

  // State for the entire import flow
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
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

  // Reset everything
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
          name, currency, current_quantity, current_unit_value.
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

      {/* Parse Results */}
      {parseResult && !isProcessing && (
        <div className="space-y-4">
          {parseResult.success ? (
            // Success - Show summary
            <Alert className="text-green-600">
              <CheckCircle className="size-4" />
              <AlertTitle>File validated successfully!</AlertTitle>
              <AlertDescription className="text-green-600">
                Found {parseResult.data?.length} holdings ready to import.
              </AlertDescription>
            </Alert>
          ) : (
            // Error - Show validation issues
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Validation Error</AlertTitle>
              <AlertDescription>
                <ul className="ml-4 list-outside list-disc space-y-1 text-sm">
                  {parseResult.errors?.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

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

        {parseResult?.success && !isProcessing && (
          <Button onClick={handleImport} disabled={isImporting}>
            {isImporting ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="size-4" />
                Import {parseResult.data?.length} holding(s)
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
