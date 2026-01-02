"use client";

import { useState, useCallback, useEffect } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FileUploadDropzone } from "@/components/ui/custom/file-upload-dropzone";
import { ImportResults } from "./import-results";
import { useImportPortfolioRecordsDialog } from "./index";

import { parsePortfolioRecordsCSV } from "@/lib/import/portfolio-records/parse-csv";
import { importPortfolioRecordsFromCSV } from "@/server/portfolio-records/import";
import { validatePortfolioRecordPositionNames } from "@/server/portfolio-records/validate";

import type { PortfolioRecordImportResult } from "@/lib/import/portfolio-records/types";

export function CSVImportForm() {
  const { setOpen, open } = useImportPortfolioRecordsDialog();

  // State for the entire import flow
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] =
    useState<PortfolioRecordImportResult | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");

  // Handle file drop/selection and immediate parsing
  const handleFileSelect = useCallback(async (file: File, content: string) => {
    setSelectedFile(file);
    setParseResult(null);
    setIsProcessing(true);
    setCsvContent(content);

    try {
      const result = await parsePortfolioRecordsCSV(content);

      // If parsing succeeded, validate that position names exist
      if (result.success && result.records.length > 0) {
        const uniqueNames = Array.from(
          new Set(result.records.map((r) => r.position_name)),
        );
        const validation =
          await validatePortfolioRecordPositionNames(uniqueNames);

        if (!validation.valid) {
          // Add missing positions to errors and mark as failed
          const missingErrors = validation.missing.map(
            (name) => `Position not found: "${name}"`,
          );
          setParseResult({
            ...result,
            success: false,
            errors: [...(result.errors ?? []), ...missingErrors],
          });
          return;
        }
      }

      setParseResult(result);
    } catch (error) {
      console.error("Error parsing CSV:", error);
      setParseResult({
        success: false,
        records: [],
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
      const result = await importPortfolioRecordsFromCSV(csvContent);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success(
        `Successfully imported ${result.importedCount} portfolio record(s)!`,
      );
      setOpen(false);
    } catch (error) {
      console.error("Import error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to import portfolio records",
      );
    } finally {
      setIsImporting(false);
    }
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
          Upload a CSV or TSV file to import portfolio records. Each record must
          refer to an existing position by name.
        </p>
        <p>
          <span className="text-foreground font-medium">Required columns:</span>{" "}
          position_name, type (buy/sell/update), date (YYYY-MM-DD), quantity,
          unit_value. Optional: description.
        </p>
        <p>
          Tip: use the exact position name you already have in Foliofox so we
          can match records to holdings.
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
        Ensure the position_name matches an existing position. A records CSV
        template will be available soon.
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
                <Spinner />
                Importing...
              </>
            ) : (
              <>
                <Upload className="size-4" />
                Import {parseResult.records?.length ?? 0} portfolio record(s)
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
