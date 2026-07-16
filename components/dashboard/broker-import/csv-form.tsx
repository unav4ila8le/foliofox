"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertCircle, Upload } from "lucide-react";
import { toast } from "sonner";

import { BrokerTransactionResults } from "./broker-transaction-results";
import { useBrokerImportDialog } from "./index";

import { Button } from "@/components/ui/button";
import { DialogBody, DialogFooter } from "@/components/ui/custom/dialog";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { FileUploadDropzone } from "@/components/ui/custom/file-upload-dropzone";
import { Spinner } from "@/components/ui/spinner";
import {
  importBrokerTransactionsFromCSV,
  previewBrokerImport,
} from "@/server/import/broker-transactions/import";
import { listSupportedBrokerDisplayNames } from "@/lib/import/broker-transactions/registry";

import type { BrokerTransactionImportPreview } from "@/server/import/broker-transactions/instrument-resolution";

export function BrokerImportCSVForm() {
  const { setOpen } = useBrokerImportDialog();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState("");
  const [preview, setPreview] = useState<BrokerTransactionImportPreview | null>(
    null,
  );
  const [selectedSymbolTickers, setSelectedSymbolTickers] = useState<
    Record<string, string>
  >({});
  const [manualPositionKeys, setManualPositionKeys] = useState<string[]>([]);
  const [excludedPositionKeys, setExcludedPositionKeys] = useState<string[]>(
    [],
  );

  const canImport = useMemo(() => {
    if (!preview?.success) return false;

    return preview.resolutions.every((resolution) => {
      if (excludedPositionKeys.includes(resolution.positionKey)) return true;
      if (resolution.state === "auto_linked") return true;
      if (resolution.state === "needs_review") {
        return Boolean(selectedSymbolTickers[resolution.positionKey]);
      }
      // Unresolved positions import either with a user-searched symbol or as
      // a manual position.
      return (
        manualPositionKeys.includes(resolution.positionKey) ||
        Boolean(selectedSymbolTickers[resolution.positionKey])
      );
    });
  }, [
    excludedPositionKeys,
    manualPositionKeys,
    preview,
    selectedSymbolTickers,
  ]);

  const handleFileSelect = useCallback(async (file: File, content: string) => {
    setSelectedFile(file);
    setCsvContent(content);
    setPreview(null);
    setSelectedSymbolTickers({});
    setManualPositionKeys([]);
    setExcludedPositionKeys([]);
    setIsProcessing(true);

    try {
      setPreview(await previewBrokerImport(content));
    } catch (error) {
      console.error("Broker import preview error:", error);
      setPreview({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to preview broker import.",
      });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleImport = async () => {
    if (!csvContent || !canImport) return;

    setIsImporting(true);
    try {
      const result = await importBrokerTransactionsFromCSV(csvContent, {
        selectedSymbolTickers,
        manualPositionKeys,
        excludedPositionKeys,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success(
        `Successfully imported ${result.importedCount} broker transaction(s).`,
      );
      setOpen(false);
    } catch (error) {
      console.error("Broker import error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to import broker CSV.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setCsvContent("");
    setPreview(null);
    setSelectedSymbolTickers({});
    setManualPositionKeys([]);
    setExcludedPositionKeys([]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DialogBody className="space-y-4">
        <div className="text-muted-foreground text-sm">
          <span className="text-foreground font-medium">
            {new Intl.ListFormat("en").format(
              listSupportedBrokerDisplayNames(),
            )}
          </span>{" "}
          are currently supported. Upload a transaction CSV, review the matched
          symbols, and Foliofox will create positions, import transactions, and
          skip records already imported.
        </div>

        <FileUploadDropzone
          accept={{
            "text/csv": [".csv"],
            "text/tab-separated-values": [".tsv"],
            "text/plain": [".csv", ".tsv"],
            "application/vnd.ms-excel": [".csv"],
          }}
          maxSize={5 * 1024 * 1024}
          onFileSelect={handleFileSelect}
          selectedFile={selectedFile}
          isProcessing={isProcessing}
          onReset={handleReset}
          disabled={isImporting}
          title="Drop your broker CSV file here"
        />

        {preview?.success ? (
          <BrokerTransactionResults
            preview={preview}
            selectedSymbolTickers={selectedSymbolTickers}
            manualPositionKeys={manualPositionKeys}
            excludedPositionKeys={excludedPositionKeys}
            onToggleExcluded={(positionKey) =>
              setExcludedPositionKeys((current) =>
                current.includes(positionKey)
                  ? current.filter((key) => key !== positionKey)
                  : [...current, positionKey],
              )
            }
            onSelectSymbol={(positionKey, ticker) =>
              setSelectedSymbolTickers((current) => ({
                ...current,
                [positionKey]: ticker,
              }))
            }
            onToggleManual={(positionKey) =>
              setManualPositionKeys((current) =>
                current.includes(positionKey)
                  ? current.filter((key) => key !== positionKey)
                  : [...current, positionKey],
              )
            }
          />
        ) : preview && !preview.success ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>{preview.error}</AlertTitle>
          </Alert>
        ) : null}

        <p className="text-muted-foreground text-sm">
          Need another broker? Use Feedback in the top-right dashboard header
          and include the broker name.
        </p>
      </DialogBody>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={isProcessing || isImporting}
        >
          Cancel
        </Button>
        <Button
          onClick={handleImport}
          disabled={!canImport || isProcessing || isImporting}
        >
          {isImporting ? (
            <>
              <Spinner />
              Importing...
            </>
          ) : (
            <>
              <Upload className="size-4" />
              Import broker transactions
            </>
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}
