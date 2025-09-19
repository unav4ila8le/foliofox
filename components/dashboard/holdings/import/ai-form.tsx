"use client";

import { useState, useCallback, useEffect } from "react";
import { Upload, AlertCircle, LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileUploadDropzone } from "@/components/ui/file-upload-dropzone";
import { useImportHoldingsDialog } from "./index";

import { importHoldings } from "@/server/holdings/import";

import type { CSVHoldingRow } from "@/lib/import/sources/csv";

// Define AI extraction result type
interface AIExtractionResult {
  success: boolean;
  holdings?: CSVHoldingRow[];
  warnings?: string[];
  errors?: string[];
}

export function AIImportForm() {
  const { setOpen, open } = useImportHoldingsDialog();

  // State for the entire import flow
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractionResult, setExtractionResult] =
    useState<AIExtractionResult | null>(null);

  // Helper function to convert file to data URL
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Helper function to convert holdings to CSV format for existing import logic
  const convertHoldingsToCSV = (holdings: CSVHoldingRow[]): string => {
    const headers = [
      "name",
      "category_code",
      "currency",
      "current_quantity",
      "current_unit_value",
      "cost_basis_per_unit",
      "symbol_id",
      "description",
    ];
    const rows = holdings.map((holding) => [
      holding.name,
      holding.category_code,
      holding.currency,
      holding.current_quantity.toString(),
      holding.current_unit_value == null || isNaN(holding.current_unit_value)
        ? ""
        : holding.current_unit_value.toString(),
      holding.cost_basis_per_unit == null || isNaN(holding.cost_basis_per_unit)
        ? ""
        : holding.cost_basis_per_unit.toString(),
      holding.symbol_id || "",
      holding.description || "",
    ]);

    return [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
  };

  // Handler for file selection and AI extraction
  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    setExtractionResult(null);
    setIsProcessing(true);

    try {
      // Convert file to data URL (base64)
      const dataUrl = await fileToDataUrl(file);

      const fileData = {
        url: dataUrl,
        mediaType: file.type,
        filename: file.name,
      };

      // Call AI extraction API
      const response = await fetch("/api/ai/extract-holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: [fileData] }),
      });

      const result = await response.json();
      setExtractionResult(result);
    } catch (error) {
      console.error("Error extracting holdings:", error);
      setExtractionResult({
        success: false,
        errors: ["Failed to process document. Please try again."],
      });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handler for final import (reuse existing import logic)
  const handleImport = async () => {
    if (!extractionResult?.holdings) return;

    setIsImporting(true);
    try {
      // Convert holdings to CSV format and import
      const csvContent = convertHoldingsToCSV(extractionResult.holdings);
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

  // Handler for resetting the form
  const handleReset = () => {
    setSelectedFile(null);
    setExtractionResult(null);
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
          Upload a document or an image containing your portfolio holdings. AI
          will automatically extract the data.
        </p>
        <p>
          <span className="text-foreground font-medium">
            Supported formats:{" "}
          </span>
          Images (PNG, JPEG, WEBP), PDFs, Excel files, broker statements, and
          more.
        </p>
      </div>

      {/* Dropzone Section */}
      <FileUploadDropzone
        accept={{
          "image/png": [".png"],
          "image/jpeg": [".jpg", ".jpeg"],
          "image/webp": [".webp"],
          "application/pdf": [".pdf"],
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
            ".xlsx",
          ],
          "application/vnd.ms-excel": [".xls"],
        }}
        maxSize={10 * 1024 * 1024} // 10MB for documents
        onFileSelect={handleFileSelect}
        selectedFile={selectedFile}
        isProcessing={isProcessing}
        onReset={handleReset}
        disabled={isImporting}
        title="Drop your document here"
      />

      {/* Extraction Results */}
      {extractionResult && !isProcessing && (
        <div className="space-y-4">
          {/* Success summary */}
          {extractionResult.success && (
            <div className="space-y-3">
              <Alert className="text-green-600">
                <Sparkles className="size-4" />
                <AlertTitle>File validated successfully!</AlertTitle>
                <AlertDescription className="text-green-600">
                  Found {extractionResult.holdings?.length} holdings ready to
                  import.
                </AlertDescription>
              </Alert>

              {/* Warnings, if any */}
              {extractionResult.warnings &&
                extractionResult.warnings.length > 0 && (
                  <Alert variant="default">
                    <AlertCircle className="size-4" />
                    <AlertTitle>Warnings</AlertTitle>
                    <AlertDescription>
                      <ul className="ml-4 list-outside list-disc space-y-1 text-sm">
                        {extractionResult.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
            </div>
          )}

          {/* Errors */}
          {!extractionResult.success && extractionResult.errors && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Errors</AlertTitle>
              <AlertDescription>
                <ul className="ml-4 list-outside list-disc space-y-1 text-sm">
                  {extractionResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Footer - Action buttons */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={isProcessing || isImporting}
        >
          Cancel
        </Button>

        {extractionResult?.success && !isProcessing && (
          <Button
            onClick={handleImport}
            disabled={isImporting || (extractionResult.errors?.length ?? 0) > 0}
          >
            {isImporting ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="size-4" />
                Import {extractionResult.holdings?.length} holding(s)
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
