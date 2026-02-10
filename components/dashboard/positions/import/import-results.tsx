import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";

import type { PositionImportResult } from "@/lib/import/positions/types";

interface ImportResultsProps {
  result: PositionImportResult;
}

function isAiTruncationWarning(message: string): boolean {
  return /^Only the first \d+ (rows|columns) were sent to AI\b/i.test(message);
}

export function ImportResults({ result }: ImportResultsProps) {
  const { success, positions, warnings = [], errors = [] } = result;

  const aiTruncationWarnings = warnings.filter(isAiTruncationWarning);
  const generalWarnings = warnings.filter(
    (warning) => !isAiTruncationWarning(warning),
  );

  const hasAiTruncationWarnings = aiTruncationWarnings.length > 0;
  const hasGeneralWarnings = generalWarnings.length > 0;
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
              Found {positions.length} position
              {positions.length === 1 ? "" : "s"} ready to import.
            </AlertDescription>
          </Alert>

          {hasAiTruncationWarnings && (
            <Alert className="border-amber-500/50 text-amber-700">
              <AlertCircle className="size-4" />
              <AlertTitle>Large Spreadsheet Notice</AlertTitle>
              <AlertDescription>
                <p className="mb-2 text-sm">
                  AI processed only part of this spreadsheet. Review before
                  importing.
                </p>
                <ul className="ml-4 list-outside list-disc space-y-1 text-sm">
                  {aiTruncationWarnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {hasGeneralWarnings && (
            <Alert variant="default">
              <AlertCircle className="size-4" />
              <AlertTitle>Warnings</AlertTitle>
              <AlertDescription>
                <ul className="ml-4 list-outside list-disc space-y-1 text-sm">
                  {generalWarnings.map((warning, index) => (
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
