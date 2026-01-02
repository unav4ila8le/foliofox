import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";

import type { PortfolioRecordImportResult } from "@/lib/import/portfolio-records/types";

interface ImportResultsProps {
  result: PortfolioRecordImportResult;
}

export function ImportResults({ result }: ImportResultsProps) {
  const { success, errors = [], records } = result;
  const hasErrors = errors.length > 0;

  // Early return for no content to show
  if (!success && !hasErrors) return null;

  return (
    <div className="space-y-4">
      {success && (
        <Alert className="text-green-600">
          <CheckCircle className="size-4" />
          <AlertTitle>File validated successfully!</AlertTitle>
          <AlertDescription className="text-green-600">
            Found {records.length} portfolio record
            {records.length === 1 ? "" : "s"} ready to import.
          </AlertDescription>
        </Alert>
      )}

      {!success && hasErrors && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Errors</AlertTitle>
          <AlertDescription>
            <ul className="ml-4 list-outside list-disc space-y-1 text-sm">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
