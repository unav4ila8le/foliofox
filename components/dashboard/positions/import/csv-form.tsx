"use client";

import { useState, useCallback, useEffect } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileUploadDropzone } from "@/components/ui/custom/file-upload-dropzone";
import { ImportResults } from "./import-results";
import { useImportPositionsDialog } from "./index";

import { usePositionCategories } from "@/hooks/use-position-categories";
import { parsePositionsCSV } from "@/lib/import/sources/csv";
import { parseRecordsCSV } from "@/lib/import/sources/records-csv";
import { importPositionsFromCSV } from "@/server/positions/import";
import { importRecordsFromCSV } from "@/server/portfolio-records/import";

import type { PositionImportResult } from "@/lib/import/types";
import type { RecordImportResult } from "@/lib/import/sources/records-csv";

type ImportMode = "positions" | "records";

type ParseResult =
  | { kind: "positions"; result: PositionImportResult }
  | { kind: "records"; result: RecordImportResult };

export function CSVImportForm() {
  const {
    setOpen,
    open,
    setReviewOpen,
    setReviewPositions,
    setReviewSymbolValidation,
    setReviewSupportedCurrencies,
  } = useImportPositionsDialog();
  const { categories } = usePositionCategories();

  // State for the entire import flow
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("positions");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");

  // Handle file drop/selection and immediate parsing
  const handleFileSelect = useCallback(
    async (file: File, content: string) => {
      setSelectedFile(file);
      setParseResult(null);
      setIsProcessing(true);
      setCsvContent(content);

      try {
        if (importMode === "positions") {
          const result = await parsePositionsCSV(content);
          setParseResult({ kind: "positions", result });
        } else {
          const result = await parseRecordsCSV(content);
          setParseResult({ kind: "records", result });
        }
      } catch (error) {
        console.error("Error parsing CSV:", error);
        if (importMode === "positions") {
          setParseResult({
            kind: "positions",
            result: {
              success: false,
              positions: [],
              errors: ["Failed to parse CSV. Please try again."],
            },
          });
        } else {
          setParseResult({
            kind: "records",
            result: {
              success: false,
              records: [],
              errors: ["Failed to parse CSV. Please try again."],
            },
          });
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [importMode],
  );

  // Handle final import
  const handleImport = async () => {
    if (!csvContent) return;

    setIsImporting(true);
    try {
      const result =
        importMode === "positions"
          ? await importPositionsFromCSV(csvContent, "asset")
          : await importRecordsFromCSV(csvContent);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success(
        `Successfully imported ${result.importedCount} ${importMode === "positions" ? "position" : "record"}(s)!`,
      );
      setOpen(false);
    } catch (error) {
      console.error("Import error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to import ${importMode === "positions" ? "positions" : "records"}`,
      );
    } finally {
      setIsImporting(false);
    }
  };

  // Handler for reviewing the import
  const handleReview = () => {
    if (!parseResult || parseResult.kind !== "positions") return;
    setReviewPositions(parseResult.result.positions);
    setReviewSymbolValidation(parseResult.result.symbolValidation ?? null);
    setReviewSupportedCurrencies(
      parseResult.result.supportedCurrencies ?? null,
    );
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground space-y-1 text-sm">
          <p className="text-foreground font-medium">Choose what to import</p>
          <p>
            Switch between importing positions (new holdings) and records
            (buys/sells/updates for existing positions).
          </p>
        </div>
        <Select
          value={importMode}
          onValueChange={(mode) => {
            setImportMode(mode as ImportMode);
            setParseResult(null);
            setSelectedFile(null);
            setCsvContent("");
          }}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Import type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="positions">Positions</SelectItem>
            <SelectItem value="records">Records</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-muted-foreground space-y-2 text-sm">
        {importMode === "positions" ? (
          <>
            <p>
              Upload a CSV or TSV file to import your positions. The first row
              should contain the headers below.
            </p>
            <p>
              <span className="text-foreground font-medium">
                Required columns:
              </span>{" "}
              name, currency, quantity,{" "}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-foreground inline-block cursor-help underline-offset-4 hover:underline">
                    unit_value
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Unit value is required unless a symbol lookup is provided.
                  When a lookup (ticker/ISIN/etc.) is present we fetch the price
                  for you.
                </TooltipContent>
              </Tooltip>
              .
            </p>
            <p>
              <span className="text-foreground font-medium">
                Optional columns:
              </span>{" "}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-foreground inline-block cursor-help underline-offset-4 hover:underline">
                    category_id
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Available categories:{" "}
                  {categories.map((category) => category.id).join(", ")}
                </TooltipContent>
              </Tooltip>
              , cost_basis_per_unit,{" "}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-foreground inline-block cursor-help underline-offset-4 hover:underline">
                    symbol_lookup
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Use any supported lookup (ticker, ISIN, etc.). Yahoo Finance
                  tickers (e.g., AAPL, MSFT, VWCE.DE) work best.
                </TooltipContent>
              </Tooltip>
              , description.
            </p>
          </>
        ) : (
          <>
            <p>
              Upload a CSV or TSV file to import portfolio records. Each record
              must refer to an existing position by name.
            </p>
            <p>
              <span className="text-foreground font-medium">
                Required columns:
              </span>{" "}
              position_name, type (buy/sell/update), date (YYYY-MM-DD),
              quantity, unit_value. Optional: description.
            </p>
            <p>
              Tip: use the exact position name you already have in Foliofox so
              we can match records to holdings.
            </p>
          </>
        )}
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
        {importMode === "positions" ? (
          <>
            Need help? Download a{" "}
            <a
              href="/sample-positions-template.csv"
              download
              className="text-primary underline-offset-4 hover:underline"
            >
              sample template
            </a>{" "}
            or export your existing positions to see the correct format.
          </>
        ) : (
          <>
            Ensure the position_name matches an existing position. A records CSV
            template will be available soon.
          </>
        )}
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

        {parseResult &&
          parseResult.kind === "positions" &&
          !parseResult.result.success &&
          !isProcessing && (
            <Button onClick={handleReview}>Review Errors</Button>
          )}

        {parseResult?.result.success && !isProcessing && (
          <>
            {parseResult.kind === "positions" && (
              <Button
                variant="outline"
                onClick={handleReview}
                disabled={isImporting}
              >
                Review Import
              </Button>
            )}
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Spinner />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  {parseResult.kind === "positions"
                    ? `Import ${parseResult.result.positions?.length ?? 0} position(s)`
                    : `Import ${parseResult.result.records?.length ?? 0} record(s)`}
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
