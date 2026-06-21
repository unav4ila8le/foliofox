"use client";

import { AlertCircle, CheckCircle } from "lucide-react";

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
              positionName={positionByKey.get(resolution.positionKey)?.name}
              brokerSymbol={
                positionByKey.get(resolution.positionKey)?.brokerSymbol
              }
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
  positionName,
  brokerSymbol,
  transactionCurrency,
  selectedTicker,
  onSelectSymbol,
}: {
  resolution: Extract<BrokerInstrumentResolution, { state: "needs_review" }>;
  positionName?: string;
  brokerSymbol?: string | null;
  transactionCurrency: string;
  selectedTicker?: string;
  onSelectSymbol: (positionKey: string, ticker: string) => void;
}) {
  const brokerIdentifier = brokerSymbol
    ? `${isIsinLike(brokerSymbol) ? "ISIN" : "Broker symbol"} ${brokerSymbol}`
    : null;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="space-y-1">
        <div className="font-medium">
          {positionName ?? "Unknown position"}
          {brokerIdentifier ? <span> - {brokerIdentifier}</span> : null}
        </div>
        <div className="text-muted-foreground text-xs">
          Choose the market symbol to link. All transactions will be converted
          to that symbol currency before import.
        </div>
      </div>

      {resolution.candidates.length > 0 && (
        <Select
          value={selectedTicker ?? ""}
          onValueChange={(ticker) =>
            onSelectSymbol(resolution.positionKey, ticker)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose symbol" />
          </SelectTrigger>
          <SelectContent>
            {resolution.candidates.map((candidate) => (
              <SelectItem key={candidate.ticker} value={candidate.ticker}>
                {candidate.ticker} ({candidate.currency})
                {candidate.exchange ? ` - ${candidate.exchange}` : ""}
                {candidate.currency === transactionCurrency
                  ? ""
                  : " (FX conversion)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function isIsinLike(value: string) {
  return /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(value.trim().toUpperCase());
}
