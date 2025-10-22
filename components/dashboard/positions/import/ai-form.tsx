"use client";

import { useState, useCallback, useEffect } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FileUploadDropzone } from "@/components/ui/custom/file-upload-dropzone";
import { ImportResults } from "./import-results";
import { useImportPositionsDialog } from "./index";

import { importPositionsFromCSV } from "@/server/positions/import";
import { positionsToCSV } from "@/lib/import/serialize";

import type { PositionImportResult } from "@/lib/import/types";

export function AIImportForm() {
  const {
    setOpen,
    open,
    setReviewOpen,
    setReviewPositions,
    setReviewSymbolValidation,
    setReviewSupportedCurrencies,
  } = useImportPositionsDialog();

  // State for the entire import flow
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractionResult, setExtractionResult] =
    useState<PositionImportResult | null>(null);

  // Helper function to convert file to data URL
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
      const response = await fetch("/api/ai/extract-positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: [fileData] }),
      });

      const result = await response.json();
      setExtractionResult(result);
    } catch (error) {
      console.error("Error extracting positions:", error);
      setExtractionResult({
        success: false,
        positions: [],
        errors: ["Failed to process document. Please try again."],
      });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handler for final import (reuse existing import logic)
  const handleImport = async () => {
    if (!extractionResult?.success) return;

    setIsImporting(true);
    try {
      // Convert positions to CSV format and import
      const csvContent = positionsToCSV(extractionResult.positions);
      const result = await importPositionsFromCSV(csvContent, "asset");

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success(
        `Successfully imported ${result.importedCount} position(s)!`,
      );
      setOpen(false);
    } catch (error) {
      console.error("Import error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to import positions",
      );
    } finally {
      setIsImporting(false);
    }
  };

  // Handler for reviewing the import
  const handleReview = () => {
    if (!extractionResult) return;
    setReviewPositions(extractionResult.positions);
    setReviewSymbolValidation(extractionResult.symbolValidation ?? null);
    setReviewSupportedCurrencies(extractionResult.supportedCurrencies ?? null);
    setReviewOpen(true);
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
          Upload a document or an image containing your portfolio positions. AI
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

      {/* Extraction results */}
      {extractionResult && !isProcessing && (
        <ImportResults result={extractionResult} />
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

        {extractionResult &&
          !extractionResult.success &&
          extractionResult.positions.length > 0 &&
          !isProcessing && (
            <Button onClick={handleReview}>Review Errors</Button>
          )}

        {extractionResult?.success && !isProcessing && (
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
                  <Spinner />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  Import {extractionResult.positions?.length} position(s)
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
