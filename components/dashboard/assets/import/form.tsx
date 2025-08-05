"use client";

import { useState } from "react";
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { useImportHoldingsDialog } from "./index";
import { parseHoldingsCSV } from "@/lib/csv-parser";
import { importHoldings } from "@/server/holdings/import";

type ParseResult = Awaited<ReturnType<typeof parseHoldingsCSV>>;

export function ImportForm() {
  const { setOpen } = useImportHoldingsDialog();

  // State for the entire import flow
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");

  // Handle file selection and immediate parsing
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a CSV file");
      return;
    }

    setSelectedFile(file);
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
        error: "Failed to read file. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

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

  return (
    <div className="space-y-6">
      {/* File Upload Section */}
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="csv-file">Select CSV file</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={isLoading}
          />
        </div>

        {selectedFile && (
          <div className="text-muted-foreground flex items-center gap-1 text-sm">
            <FileText className="size-4" />
            <span>
              {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <LoaderCircle className="mr-2 size-6 animate-spin" />
          <span>Processing file...</span>
        </div>
      )}

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

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={isLoading}
        >
          Cancel
        </Button>

        {parseResult && !parseResult.success && (
          <Button variant="outline" onClick={handleReset} disabled={isLoading}>
            Try Again
          </Button>
        )}

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
