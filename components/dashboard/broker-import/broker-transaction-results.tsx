"use client";

import { AlertCircle, CheckCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { SymbolSearch } from "@/components/dashboard/symbol-search";

import { getBrokerDisplayName } from "@/lib/import/broker-transactions/registry";

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
        <AlertTitle>
          {formatBrokerSource(preview.source)} transaction CSV detected
        </AlertTitle>
        <AlertDescription className="text-green-600">
          {preview.positionsToCreate.length} positions,{" "}
          {preview.recordsToImportCount} transactions
          {needsReview.length > 0
            ? `, ${needsReview.length} need symbol review`
            : ""}
          {preview.duplicateRecordsSkippedCount > 0
            ? `, ${preview.duplicateRecordsSkippedCount} duplicates skipped`
            : ""}
          {preview.ignoredRowCount > 0
            ? `, ${preview.ignoredRowCount} non-trading rows ignored`
            : ""}
          .
        </AlertDescription>
      </Alert>

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
            const selectedTicker =
              selectedSymbolTickers[resolution.positionKey];
            return (
              <div
                key={resolution.positionKey}
                className="space-y-3 rounded-md border p-3"
              >
                <div className="space-y-1">
                  <div className="font-medium">{position?.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {resolution.warning} Search a market symbol to link, or
                    import as a manual position without market prices.
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <SymbolSearch
                    field={{
                      value: selectedTicker,
                      // Linking a symbol and manual import are exclusive.
                      onChange: (ticker) => {
                        if (ticker && isManual) {
                          onToggleManual(resolution.positionKey);
                        }
                        onSelectSymbol(resolution.positionKey, ticker);
                      },
                    }}
                    className="w-full sm:flex-1"
                  />
                  <Button
                    type="button"
                    variant={isManual ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (!isManual && selectedTicker) {
                        onSelectSymbol(resolution.positionKey, "");
                      }
                      onToggleManual(resolution.positionKey);
                    }}
                  >
                    {isManual ? "Manual selected" : "Import manually"}
                  </Button>
                </div>
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
          Choose the market symbol to link. Suggested listings are shown first;
          type to search any other symbol. All transactions will be converted to
          that symbol currency before import.
        </div>
      </div>

      <SymbolSearch
        field={{
          value: selectedTicker,
          onChange: (ticker) => onSelectSymbol(resolution.positionKey, ticker),
        }}
        className="w-full"
        // Provider candidates seed the pre-search list; the currency slot
        // flags listings that would trigger historical FX conversion.
        defaultResults={resolution.candidates.map((candidate) => ({
          id: candidate.ticker,
          nameDisp: candidate.name,
          exchange: candidate.exchange,
          typeDisp:
            candidate.currency === transactionCurrency
              ? candidate.currency
              : `${candidate.currency} · FX conversion`,
        }))}
      />
    </div>
  );
}

function isIsinLike(value: string) {
  return /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(value.trim().toUpperCase());
}

function formatBrokerSource(source: string) {
  return (
    getBrokerDisplayName(source) ??
    source
      .split("_")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" ")
  );
}
