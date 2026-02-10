import { aiModel, extractionModelId } from "@/server/ai/provider";
import { generateText, Output } from "ai";

import {
  type PositionCanonicalHeader,
  REQUIRED_POSITION_HEADERS,
  buildPositionColumnMap,
} from "@/lib/import/positions/header-mapper";
import { parsePositionsCSV } from "@/lib/import/positions/parse-csv";
import {
  TabularFileError,
  TABULAR_FILE_MAX_BYTES,
  buildAiTableText,
  countNonEmptyRows,
  isTabularFile,
  parseTabularFileFromDataUrl,
  rowsToCsv,
  selectBestSheet,
} from "@/lib/import/shared/tabular-file.server";
import {
  createExtractionResultSchema,
  createExtractionPrompt,
  postProcessExtractedPositions,
  type ExtractionResult,
} from "@/lib/import/positions/ai-extraction";
import type { PositionImportResult } from "@/lib/import/positions/types";

export const maxDuration = 30;

const AI_TABLE_MAX_ROWS = 250;
const AI_TABLE_MAX_COLUMNS = 40;

interface UploadedFilePart {
  url: string;
  mediaType?: string | null;
  filename?: string | null;
}

interface PositionSheetScoreMetadata {
  headerRowIndex: number;
  requiredHeaderMatches: number;
  mappedHeaderCount: number;
  dataRowCount: number;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  // Filters out null, undefined, and empty-string entries.
  return Array.from(
    new Set(values.filter((value): value is string => !!value)),
  );
}

function countRequiredHeaderMatches(
  columnMap: Map<PositionCanonicalHeader, number>,
): number {
  return REQUIRED_POSITION_HEADERS.filter((header) => columnMap.has(header))
    .length;
}

function scoreSheetForPositions(rows: string[][]): {
  score: number;
  confidence: "high" | "medium" | "low";
  metadata: PositionSheetScoreMetadata;
} {
  // Heuristic scoring:
  // - prioritize required header matches heavily
  // - then prefer broader canonical header coverage
  // - then prefer rows that actually contain data
  // - slightly penalize later header rows
  const maxHeaderCandidates = Math.min(rows.length, 10);
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestConfidence: "high" | "medium" | "low" = "low";
  let bestMetadata: PositionSheetScoreMetadata = {
    headerRowIndex: 0,
    requiredHeaderMatches: 0,
    mappedHeaderCount: 0,
    dataRowCount: 0,
  };

  for (
    let headerRowIndex = 0;
    headerRowIndex < maxHeaderCandidates;
    headerRowIndex++
  ) {
    const rawHeaders = rows[headerRowIndex] ?? [];
    const columnMap = buildPositionColumnMap(rawHeaders);
    const mappedHeaderCount = columnMap.size;
    const requiredHeaderMatches = countRequiredHeaderMatches(columnMap);
    const dataRowCount = countNonEmptyRows(rows.slice(headerRowIndex + 1));

    const score =
      requiredHeaderMatches * 100 +
      mappedHeaderCount * 10 +
      Math.min(dataRowCount, 100) -
      headerRowIndex * 2;

    let confidence: "high" | "medium" | "low" = "low";
    const hasAllRequiredHeaders =
      requiredHeaderMatches === REQUIRED_POSITION_HEADERS.length;
    if (hasAllRequiredHeaders && dataRowCount > 0) {
      confidence = mappedHeaderCount >= 4 ? "high" : "medium";
    } else if (requiredHeaderMatches >= 2 && dataRowCount > 0) {
      confidence = "medium";
    }

    const shouldReplace =
      score > bestScore ||
      (score === bestScore &&
        requiredHeaderMatches > bestMetadata.requiredHeaderMatches) ||
      (score === bestScore &&
        requiredHeaderMatches === bestMetadata.requiredHeaderMatches &&
        mappedHeaderCount > bestMetadata.mappedHeaderCount);

    if (shouldReplace) {
      bestScore = score;
      bestConfidence = confidence;
      bestMetadata = {
        headerRowIndex,
        requiredHeaderMatches,
        mappedHeaderCount,
        dataRowCount,
      };
    }
  }

  return {
    score: bestScore,
    confidence: bestConfidence,
    metadata: bestMetadata,
  };
}

function buildTabularPrompt(
  extractionPrompt: string,
  sheetName: string,
  tableText: string,
): string {
  // Tabs are used to avoid CSV-style comma ambiguity inside cell values.
  return `${extractionPrompt}

The uploaded file is a spreadsheet. The content below is a normalized, tab-separated export from sheet "${sheetName}".
The first row is the header row. Only use values that appear in this table.

${tableText}`;
}

function mergeWarnings(
  ...warningGroups: Array<Array<string> | undefined>
): string[] | undefined {
  const warnings = uniqueStrings(warningGroups.flatMap((group) => group ?? []));
  return warnings.length ? warnings : undefined;
}

function mergeErrors(
  ...errorGroups: Array<Array<string> | undefined>
): string[] | undefined {
  const errors = uniqueStrings(errorGroups.flatMap((group) => group ?? []));
  return errors.length ? errors : undefined;
}

function createTabularFailureResult(
  errors: string[],
  warnings?: string[],
): PositionImportResult {
  return {
    success: false,
    positions: [],
    warnings: warnings && warnings.length ? warnings : undefined,
    errors,
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const file = body?.files?.[0] as UploadedFilePart | undefined;
  if (!file?.url)
    return Response.json(
      { success: false, errors: ["No file provided"] },
      { status: 400 },
    );

  const { url, mediaType, filename } = file;

  if (isTabularFile({ mediaType, filename })) {
    try {
      const parsedTabularFile = parseTabularFileFromDataUrl({
        dataUrl: url,
        mediaType,
        filename,
        maxBytes: TABULAR_FILE_MAX_BYTES,
      });

      const nonEmptySheets = parsedTabularFile.sheets.filter(
        (sheet) => countNonEmptyRows(sheet.rows) > 0,
      );

      if (nonEmptySheets.length === 0) {
        return Response.json(
          createTabularFailureResult([
            "The spreadsheet is empty. Please upload a file with header and data rows.",
          ]),
          { status: 400 },
        );
      }

      const selectedSheet = selectBestSheet(nonEmptySheets, (sheet) =>
        scoreSheetForPositions(sheet.rows),
      );
      const headerRowIndex = selectedSheet.metadata.headerRowIndex;
      const selectedRows = selectedSheet.sheet.rows.slice(headerRowIndex);

      if (selectedRows.length < 2) {
        return Response.json(
          createTabularFailureResult([
            `Sheet "${selectedSheet.sheet.name}" does not contain enough rows to import positions.`,
          ]),
          { status: 400 },
        );
      }

      const [extractionPrompt, schema] = await Promise.all([
        createExtractionPrompt(),
        createExtractionResultSchema(),
      ]);

      const aiTable = buildAiTableText(selectedRows, {
        maxRows: AI_TABLE_MAX_ROWS,
        maxColumns: AI_TABLE_MAX_COLUMNS,
      });

      const tabularPrompt = buildTabularPrompt(
        extractionPrompt,
        selectedSheet.sheet.name,
        aiTable.text,
      );

      let processedByAI: PositionImportResult;
      try {
        const aiResult = await generateText({
          model: aiModel(extractionModelId),
          temperature: 0,
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: tabularPrompt }],
            },
          ],
          output: Output.object({ schema }),
        });

        processedByAI = aiResult.output
          ? await postProcessExtractedPositions(
              aiResult.output as ExtractionResult,
            )
          : ({
              success: false,
              positions: [],
              errors: ["AI extraction returned an empty structured response."],
            } satisfies PositionImportResult);
      } catch (error) {
        console.error("AI extraction failed for tabular input:", error);
        processedByAI = {
          success: false,
          positions: [],
          errors: ["AI extraction failed for this spreadsheet."],
        };
      }

      const parsingPipelineWarnings = mergeWarnings(
        parsedTabularFile.warnings,
        selectedSheet.warnings,
        aiTable.warnings,
      );

      if (processedByAI.success) {
        return Response.json({
          ...processedByAI,
          warnings: mergeWarnings(
            processedByAI.warnings,
            parsingPipelineWarnings,
          ),
        });
      }

      const fallbackCsvContent = rowsToCsv(selectedRows);
      const fallbackParsed = await parsePositionsCSV(fallbackCsvContent);

      if (fallbackParsed.success) {
        return Response.json({
          ...fallbackParsed,
          warnings: mergeWarnings(
            fallbackParsed.warnings,
            parsingPipelineWarnings,
            processedByAI.warnings,
            [
              "AI extraction for this spreadsheet was uncertain, so deterministic spreadsheet parsing was used as fallback.",
            ],
          ),
        });
      }

      const combinedErrors = mergeErrors(
        processedByAI.errors,
        fallbackParsed.errors,
      );
      const combinedWarnings = mergeWarnings(
        parsingPipelineWarnings,
        processedByAI.warnings,
        fallbackParsed.warnings,
      );
      const fallbackOrAIPositions =
        fallbackParsed.positions.length > 0
          ? fallbackParsed.positions
          : processedByAI.positions;

      return Response.json({
        success: false,
        positions: fallbackOrAIPositions,
        errors: combinedErrors ?? [
          "Failed to extract positions from the spreadsheet.",
        ],
        warnings: combinedWarnings,
        symbolValidation:
          fallbackParsed.symbolValidation ?? processedByAI.symbolValidation,
        supportedCurrencies:
          fallbackParsed.supportedCurrencies ??
          processedByAI.supportedCurrencies,
      } as PositionImportResult);
    } catch (error) {
      if (error instanceof TabularFileError) {
        return Response.json(createTabularFailureResult([error.message]), {
          status: 400,
        });
      }
      console.error("Unexpected tabular parsing error:", error);
      return Response.json(
        createTabularFailureResult([
          "Failed to process spreadsheet file. Please try again.",
        ]),
        { status: 400 },
      );
    }
  }

  const [extractionPrompt, schema] = await Promise.all([
    createExtractionPrompt(),
    createExtractionResultSchema(),
  ]);

  try {
    const result = await generateText({
      model: aiModel(extractionModelId),
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: extractionPrompt },
            {
              type: "file",
              data: url,
              mediaType: mediaType ?? "application/octet-stream",
            },
          ],
        },
      ],
      output: Output.object({ schema }),
    });

    if (!result.output) {
      return Response.json(
        {
          success: false,
          positions: [],
          errors: ["Failed to process document. Please try again."],
        } as PositionImportResult,
        { status: 400 },
      );
    }

    const processed = await postProcessExtractedPositions(
      result.output as ExtractionResult,
    );
    return Response.json(processed);
  } catch (error) {
    console.error("AI extraction failed:", error);
    return Response.json(
      {
        success: false,
        positions: [],
        errors: ["Failed to process document. Please try again."],
      } as PositionImportResult,
      { status: 400 },
    );
  }
}
