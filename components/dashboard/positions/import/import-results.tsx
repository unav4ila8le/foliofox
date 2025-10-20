import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";

import type { PositionImportResult } from "@/lib/import/types";

interface ImportResultsProps {
  result: PositionImportResult;
}

export function ImportResults({ result }: ImportResultsProps) {
  const { success, positions, warnings = [], errors = [] } = result;
  const positionsCount = positions.length;

  const hasWarnings = warnings.length > 0;
  const hasErrors = errors.length > 0;

  // Early return for no content to show
  if (!success && !hasErrors) return null;

  return (
    <div className="space-y-4">
      {success && (
        <div className="space-y-3">
          <Alert className="text-green-600">
            <CheckCircle className="size-4" />
            <AlertTitle>File validated successfully!</AlertTitle>
            <AlertDescription className="text-green-600">
              Found {positionsCount} position(s) ready to import.
            </AlertDescription>
          </Alert>

          {hasWarnings && (
            <Alert variant="default">
              <AlertCircle className="size-4" />
              <AlertTitle>Warnings</AlertTitle>
              <AlertDescription>
                <ul className="ml-4 list-outside list-disc space-y-1 text-sm">
                  {warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
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
