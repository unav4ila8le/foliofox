"use client";

import { AlertCircle, CheckCircle, Link2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  BrokerInstrumentResolution,
  BrokerTransactionImportPreview,
} from "@/server/import/broker-transactions/instrument-resolution";

interface BrokerTransactionResultsProps {
  preview: Extract<BrokerTransactionImportPreview, { success: true }>;
  selectedSymbolTickers: Record<string, string>;
  manualPositionKeys: string[];
  onSelectSymbol: (positionKey: string, ticker: string) => void;
  onToggleManual: (positionKey: string) => void;
}

export function BrokerTransactionResults({
  preview,
  selectedSymbolTickers,
  manualPositionKeys,
  onSelectSymbol,
  onToggleManual,
}: BrokerTransactionResultsProps) {
  const positionByKey = new Map(
    preview.positionsToCreate.map((position) => [
      position.positionKey,
      position,
    ]),
  );
  const autoLinked = preview.resolutions.filter(
    (resolution) => resolution.state === "auto_linked",
  );
  const needsReview = preview.resolutions.filter(
    (resolution) => resolution.state === "needs_review",
  );
  const unresolved = preview.resolutions.filter(
    (resolution) => resolution.state === "unresolved",
  );

  return (
    <div className="space-y-4">
      <Alert className="text-green-600">
        <CheckCircle className="size-4" />
        <AlertTitle>Broker transaction CSV detected</AlertTitle>
        <AlertDescription className="text-green-600">
          Found {preview.positionsToCreate.length} position(s) to create,{" "}
          {preview.matchedPositions.length} existing match(es), and{" "}
          {preview.recordsToImportCount} record(s) to import.
        </AlertDescription>
      </Alert>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <SummaryItem label="Auto-linked symbols" value={autoLinked.length} />
        <SummaryItem label="Needs symbol review" value={needsReview.length} />
        <SummaryItem label="Manual fallback" value={unresolved.length} />
        <SummaryItem
          label="Duplicate records skipped"
          value={preview.duplicateRecordsSkippedCount}
        />
        <SummaryItem label="Ignored rows" value={preview.ignoredRowCount} />
        <SummaryItem
          label="Existing positions"
          value={preview.matchedPositions.length}
        />
      </div>

      {needsReview.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Symbol Review</h4>
          {needsReview.map((resolution) => (
            <SymbolReviewRow
              key={resolution.positionKey}
              resolution={resolution}
              transactionCurrency={
                positionByKey.get(resolution.positionKey)?.currency ?? ""
              }
              selectedTicker={selectedSymbolTickers[resolution.positionKey]}
              onSelectSymbol={onSelectSymbol}
            />
          ))}
        </div>
      )}

      {unresolved.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Manual Fallback</h4>
          {unresolved.map((resolution) => {
            const position = positionByKey.get(resolution.positionKey);
            const isManual = manualPositionKeys.includes(
              resolution.positionKey,
            );
            return (
              <div
                key={resolution.positionKey}
                className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="font-medium">{position?.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {resolution.warning}
                  </div>
                </div>
                <Button
                  type="button"
                  variant={isManual ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => onToggleManual(resolution.positionKey)}
                >
                  {isManual ? "Manual selected" : "Import manually"}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {preview.warnings.length > 0 && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Warnings</AlertTitle>
          <AlertDescription>
            <ul className="ml-4 list-outside list-disc space-y-1 text-sm">
              {preview.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/30 flex items-center justify-between gap-2 rounded-md border px-3 py-2">
      <span className="text-muted-foreground truncate">{label}</span>
      <Badge variant="outline" className="bg-background">
        {value}
      </Badge>
    </div>
  );
}

function SymbolReviewRow({
  resolution,
  transactionCurrency,
  selectedTicker,
  onSelectSymbol,
}: {
  resolution: Extract<BrokerInstrumentResolution, { state: "needs_review" }>;
  transactionCurrency: string;
  selectedTicker?: string;
  onSelectSymbol: (positionKey: string, ticker: string) => void;
}) {
  const sameCurrencyCandidates = resolution.candidates.filter(
    (candidate) => candidate.currency === transactionCurrency,
  );

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="font-medium">{resolution.warning}</div>
          <div className="text-muted-foreground text-xs">
            Different-currency candidates are shown for context only.
          </div>
        </div>
        <Badge
          variant={sameCurrencyCandidates.length > 0 ? "secondary" : "outline"}
        >
          {transactionCurrency}
        </Badge>
      </div>

      {sameCurrencyCandidates.length > 0 ? (
        <Select
          value={selectedTicker ?? ""}
          onValueChange={(ticker) =>
            onSelectSymbol(resolution.positionKey, ticker)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose matching symbol" />
          </SelectTrigger>
          <SelectContent>
            {sameCurrencyCandidates.map((candidate) => (
              <SelectItem key={candidate.ticker} value={candidate.ticker}>
                {candidate.ticker} ({candidate.currency})
                {candidate.exchange ? ` - ${candidate.exchange}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>No same-currency symbol</AlertTitle>
          <AlertDescription>
            This position cannot be symbol-backed in v1 without FX conversion.
          </AlertDescription>
        </Alert>
      )}

      {resolution.candidates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {resolution.candidates.map((candidate) => (
            <Badge
              key={candidate.ticker}
              variant={
                candidate.currency === transactionCurrency
                  ? "outline"
                  : "secondary"
              }
            >
              <Link2 className="size-3" />
              {candidate.ticker} ({candidate.currency})
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
