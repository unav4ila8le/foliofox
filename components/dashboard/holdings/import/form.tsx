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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useImportHoldingsDialog } from "./index";
import { useAssetCategories } from "@/hooks/use-asset-categories";
import { parseHoldingsCSV } from "@/lib/csv-parser/index";
import { importHoldings } from "@/server/holdings/import";
import { cn } from "@/lib/utils";

type ParseResult = Awaited<ReturnType<typeof parseHoldingsCSV>>;

export function ImportForm() {
  const { setOpen, open } = useImportHoldingsDialog();
  const { categories } = useAssetCategories();

  // State for the entire import flow
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");

  // Handle file drop/selection and immediate parsing
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setSelectedFile(file);
    setParseResult(null);
    setIsProcessing(true);

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
      setIsProcessing(false);
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
        "text/tab-separated-values": [".tsv"],
        "text/plain": [".csv", ".tsv"],
        "application/vnd.ms-excel": [".csv"],
      },
      maxSize: 5 * 1024 * 1024, // 5MB
      multiple: false,
      disabled: isProcessing || isImporting,
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

  // Reset when dialog closes (any way it closes)
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
          name,{" "}
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
          , currency, current_quantity, current_unit_value,{" "}
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
      <div
        {...getRootProps()}
        className={cn(
          "bg-muted/30 relative rounded-lg border border-dashed p-6 text-center transition-colors",
          "hover:bg-muted hover:border-primary/50",
          isDragActive && "bg-muted border-primary/50",
          isDragReject && "bg-destructive/10 border-destructive",
          (isProcessing || isImporting) && "pointer-events-none opacity-50",
        )}
      >
        <input {...getInputProps()} />

        {isProcessing ? (
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
