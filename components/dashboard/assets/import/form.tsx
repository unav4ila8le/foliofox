"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  LoaderCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { useImportHoldingsDialog } from "./index";
import { parseHoldingsCSV } from "@/lib/csv-parser";
import { importHoldings } from "@/server/holdings/import";
import { cn } from "@/lib/utils";

type ParseResult = Awaited<ReturnType<typeof parseHoldingsCSV>>;

export function ImportForm() {
  const { setOpen, open } = useImportHoldingsDialog();

  // State for the entire import flow
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");

  // Handle file drop/selection and immediate parsing
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setSelectedFile(file);
    setParseResult(null);
    setIsLoading(true);

    try {
      // Read file content
      const content = await readFileContent(file);
      setCsvContent(content);

      // Parse CSV immediately
      const result = await parseHoldingsCSV(content);
      setParseResult(result);
    } catch (error) {
      console.error("Error reading file:", error);
      toast.error("Failed to read file");
      setParseResult({
        success: false,
        errors: ["Failed to read file. Please try again."],
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle file rejection
  const onDropRejected = useCallback((rejectedFiles: FileRejection[]) => {
    const rejection = rejectedFiles[0];
    const errorCode = rejection?.errors?.[0]?.code;

    let message = "Invalid file. Please try again.";

    if (errorCode === "file-too-large") {
      message = "File is too large. Maximum size is 5MB.";
    } else if (errorCode === "file-invalid-type") {
      message = "Invalid file type. Please select a CSV file.";
    }

    toast.error(message);
  }, []);

  // Setup dropzone
  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      onDropRejected,
      accept: {
        "text/csv": [".csv"],
        "application/vnd.ms-excel": [".csv"],
        "text/plain": [".csv"],
      },
      maxSize: 5 * 1024 * 1024, // 5MB
      multiple: false,
      disabled: isLoading,
    });

  // Helper function to read file content
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // Handle final import
  const handleImport = async () => {
    if (!csvContent) return;

    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  // Reset everything
  const handleReset = () => {
    setSelectedFile(null);
    setParseResult(null);
    setCsvContent("");
  };

  // Reset when dialog closes (any way it closes)
  useEffect(() => {
    if (!open) {
      handleReset();
    }
  }, [open]);

  return (
    <div className="space-y-4">
      <div className="text-muted-foreground text-sm">
        <span className="text-foreground font-medium">Required columns:</span>{" "}
        name, category_code, currency, current_quantity, current_unit_value,
        symbol_id, description.
      </div>

      {/* Dropzone Section */}
      <div
        {...getRootProps()}
        className={cn(
          "bg-muted/30 relative rounded-lg border border-dashed p-6 text-center transition-colors",
          "hover:bg-muted hover:border-primary/50",
          isDragActive && "bg-muted border-primary/50",
          isDragReject && "bg-destructive/10 border-destructive",
          isLoading && "cursor-not-allowed opacity-50",
        )}
      >
        <input {...getInputProps()} />

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <LoaderCircle className="mr-2 size-4 animate-spin" />
            <span>Processing file...</span>
          </div>
        ) : selectedFile ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-1">
              <FileText className="size-4" />
              <span className="font-medium">{selectedFile.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
                className="text-muted-foreground hover:text-foreground absolute top-2 right-2"
              >
                <X className="size-4" />
                <span className="sr-only">Reset</span>
              </button>
            </div>
            <p className="text-muted-foreground text-sm">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="text-muted-foreground mx-auto size-8" />
            <div>
              <p className="font-medium">
                {isDragActive
                  ? "Drop your CSV file here"
                  : "Drag and drop your CSV file here"}
              </p>
              <p className="text-muted-foreground text-sm">
                or click to browse (max 5MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Parse Results */}
      {parseResult && !isLoading && (
        <div className="space-y-4">
          {parseResult.success ? (
            // Success - Show summary
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <CheckCircle className="size-4" />
              <AlertTitle>File validated successfully!</AlertTitle>
              <AlertDescription className="text-green-800">
                Found {parseResult.data?.length} holdings ready to import.
              </AlertDescription>
            </Alert>
          ) : (
            // Error - Show validation issues
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Validation Error</AlertTitle>
              <AlertDescription>
                <ul className="ml-4 list-outside list-disc space-y-2 text-sm">
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
          className="text-primary underline-offset-2 hover:underline"
        >
          sample template
        </a>{" "}
        or export your existing holdings to see the correct format.
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={isLoading}
        >
          Cancel
        </Button>

        {parseResult?.success && (
          <Button onClick={handleImport} disabled={isLoading}>
            {isLoading ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="size-4" />
                Import {parseResult.data?.length} holdings
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
