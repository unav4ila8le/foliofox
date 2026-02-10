/**
 * Shared tabular import helpers for server-side ingestion.
 *
 * Responsibilities:
 * - Detect tabular file types (CSV/TSV/XLSX/XLS)
 * - Decode and validate data URLs with size limits
 * - Parse CSV/TSV and Excel workbooks into normalized rows
 * - Expand merged cells and handle formula fallbacks
 * - Provide generic sheet-selection and serialization helpers
 */
import * as XLSX from "xlsx";

import {
  detectCSVDelimiter,
  parseCSVRowValues,
} from "@/lib/import/shared/csv-parser-utils";

export type TabularFileKind = "csv" | "tsv" | "xlsx" | "xls";

type SheetSelectionConfidence = "high" | "medium" | "low";

interface DetectTabularFileKindInput {
  mediaType?: string | null;
  filename?: string | null;
  dataUrlMediaType?: string | null;
}

export interface ParseTabularFileInput extends DetectTabularFileKindInput {
  dataUrl: string;
  maxBytes?: number;
}

export interface ParsedTabularSheet {
  name: string;
  rows: string[][];
  warnings?: string[];
}

export interface ParsedTabularFile {
  kind: TabularFileKind;
  fileSizeBytes: number;
  mediaType: string | null;
  sheets: ParsedTabularSheet[];
  warnings: string[];
}

export interface SheetScoreResult<Metadata> {
  score: number;
  confidence: SheetSelectionConfidence;
  metadata: Metadata;
}

export interface SelectedSheetResult<Metadata> {
  sheet: ParsedTabularSheet;
  sheetIndex: number;
  confidence: SheetSelectionConfidence;
  metadata: Metadata;
  warnings: string[];
}

export interface BuildAiTableTextOptions {
  maxRows?: number;
  maxColumns?: number;
}

export interface BuildAiTableTextResult {
  text: string;
  warnings: string[];
  rowCount: number;
  columnCount: number;
}

type TabularFileErrorCode =
  | "invalid_data_url"
  | "unsupported_file_type"
  | "file_too_large"
  | "invalid_tabular_file";

interface DecodedDataUrl {
  data: Buffer;
  mediaType: string | null;
}

export const TABULAR_FILE_MAX_BYTES = 10 * 1024 * 1024;

const EXCEL_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/excel",
  "application/x-excel",
  "application/x-msexcel",
]);

const CSV_MIME_TYPES = new Set(["text/csv", "application/csv"]);
const TSV_MIME_TYPES = new Set(["text/tab-separated-values"]);

export class TabularFileError extends Error {
  readonly code: TabularFileErrorCode;

  constructor(code: TabularFileErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "TabularFileError";
  }
}

function normalizeMimeType(mediaType?: string | null): string | null {
  if (!mediaType) return null;
  const normalized = mediaType.split(";")[0]?.trim().toLowerCase();
  return normalized || null;
}

function getFileExtension(filename?: string | null): string | null {
  if (!filename) return null;
  const trimmed = filename.trim().toLowerCase();
  const dotIndex = trimmed.lastIndexOf(".");
  if (dotIndex < 0 || dotIndex === trimmed.length - 1) return null;
  return trimmed.slice(dotIndex + 1);
}

function toDisplaySheetName(filename?: string | null): string {
  if (!filename) return "Data";
  const cleaned = filename.trim();
  if (!cleaned) return "Data";
  return cleaned.replace(/\.[^.]+$/, "") || "Data";
}

function decodeDataUrl(dataUrl: string): DecodedDataUrl {
  if (!dataUrl.startsWith("data:")) {
    throw new TabularFileError(
      "invalid_data_url",
      "Invalid upload payload. Expected a data URL.",
    );
  }

  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) {
    throw new TabularFileError(
      "invalid_data_url",
      "Invalid upload payload. Could not decode file data.",
    );
  }

  const metadataSection = dataUrl.slice(5, commaIndex);
  const payloadSection = dataUrl.slice(commaIndex + 1);
  const isBase64 = /;base64/i.test(metadataSection);
  const mediaType = normalizeMimeType(metadataSection.split(";")[0] || null);

  try {
    const data = isBase64
      ? Buffer.from(payloadSection, "base64")
      : Buffer.from(decodeURIComponent(payloadSection), "utf8");
    return { data, mediaType };
  } catch {
    throw new TabularFileError(
      "invalid_data_url",
      "Invalid upload payload. Could not decode file data.",
    );
  }
}

function normalizeCellValue(value: string): string {
  return value
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDelimitedContent(
  text: string,
  delimiterHint: "," | "\t",
): string[][] {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  const delimiter =
    delimiterHint === "\t" ? "\t" : (detectCSVDelimiter(text) as string);

  return lines.map((line) =>
    parseCSVRowValues(line, delimiter).map((value) =>
      normalizeCellValue(value),
    ),
  );
}

function getCellAddressKey(rowIndex: number, columnIndex: number): string {
  return `${rowIndex}:${columnIndex}`;
}

function stringifySheetCell(
  cell: XLSX.CellObject | undefined,
  warnings: Set<string>,
): string {
  if (!cell) return "";

  if (typeof cell.w === "string" && cell.w.trim() !== "") {
    return normalizeCellValue(cell.w);
  }

  if (cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== "") {
    return normalizeCellValue(String(cell.v));
  }

  if (typeof cell.f === "string" && cell.f.trim() !== "") {
    warnings.add(
      "Some formula cells did not expose computed values, so formula text was used.",
    );
    return normalizeCellValue(`=${cell.f}`);
  }

  return "";
}

function buildMergedCellValueMap(
  sheet: XLSX.WorkSheet,
  warnings: Set<string>,
): Map<string, string> {
  const mergedValueMap = new Map<string, string>();
  const merges = (sheet["!merges"] ?? []) as XLSX.Range[];

  for (const mergeRange of merges) {
    const topLeftAddress = XLSX.utils.encode_cell({
      r: mergeRange.s.r,
      c: mergeRange.s.c,
    });
    const topLeftCell = sheet[topLeftAddress] as XLSX.CellObject | undefined;
    const mergedValue = stringifySheetCell(topLeftCell, warnings);
    if (!mergedValue) continue;

    for (let row = mergeRange.s.r; row <= mergeRange.e.r; row++) {
      for (let column = mergeRange.s.c; column <= mergeRange.e.c; column++) {
        mergedValueMap.set(getCellAddressKey(row, column), mergedValue);
      }
    }
  }

  return mergedValueMap;
}

function parseWorksheet(
  sheetName: string,
  sheet: XLSX.WorkSheet,
): ParsedTabularSheet {
  const ref = sheet["!ref"];
  if (!ref) {
    return { name: sheetName, rows: [] };
  }

  const range = XLSX.utils.decode_range(ref);
  const warnings = new Set<string>();
  const mergedValueMap = buildMergedCellValueMap(sheet, warnings);
  const rows: string[][] = [];

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex++) {
    const rowValues: string[] = [];
    let lastNonEmptyColumn = -1;

    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex++) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = sheet[address] as XLSX.CellObject | undefined;
      const directValue = stringifySheetCell(cell, warnings);
      const value =
        directValue ||
        mergedValueMap.get(getCellAddressKey(rowIndex, columnIndex)) ||
        "";

      rowValues.push(value);
      if (value !== "") lastNonEmptyColumn = columnIndex;
    }

    if (lastNonEmptyColumn >= range.s.c) {
      rows.push(rowValues.slice(0, lastNonEmptyColumn - range.s.c + 1));
    }
  }

  return {
    name: sheetName,
    rows,
    warnings: warnings.size ? Array.from(warnings) : undefined,
  };
}

function parseWorkbook(data: Buffer): ParsedTabularSheet[] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, {
      type: "buffer",
      cellFormula: true,
      cellNF: false,
      cellStyles: false,
      dense: false,
    });
  } catch {
    throw new TabularFileError(
      "invalid_tabular_file",
      "Invalid Excel file. Please upload a valid .xlsx or .xls document.",
    );
  }

  const sheetNames = workbook.SheetNames ?? [];
  if (sheetNames.length === 0) {
    throw new TabularFileError(
      "invalid_tabular_file",
      "The spreadsheet is empty. Please upload a file with at least one sheet.",
    );
  }

  return sheetNames.map((name) => parseWorksheet(name, workbook.Sheets[name]));
}

function removeUtf8Bom(content: string): string {
  return content.replace(/^\uFEFF/, "");
}

export function detectTabularFileKind({
  mediaType,
  filename,
  dataUrlMediaType,
}: DetectTabularFileKindInput): TabularFileKind | null {
  const extension = getFileExtension(filename);
  if (extension === "csv") return "csv";
  if (extension === "tsv") return "tsv";
  if (extension === "xlsx") return "xlsx";
  if (extension === "xls") return "xls";

  const normalizedMediaType =
    normalizeMimeType(mediaType) ?? normalizeMimeType(dataUrlMediaType);

  if (!normalizedMediaType) return null;
  if (CSV_MIME_TYPES.has(normalizedMediaType)) return "csv";
  if (TSV_MIME_TYPES.has(normalizedMediaType)) return "tsv";
  if (
    normalizedMediaType ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "xlsx";
  }
  if (EXCEL_MIME_TYPES.has(normalizedMediaType)) return "xls";
  return null;
}

export function isTabularFile(input: DetectTabularFileKindInput): boolean {
  return detectTabularFileKind(input) !== null;
}

export function parseTabularFileFromDataUrl({
  dataUrl,
  mediaType,
  filename,
  maxBytes = TABULAR_FILE_MAX_BYTES,
}: ParseTabularFileInput): ParsedTabularFile {
  const decoded = decodeDataUrl(dataUrl);
  if (decoded.data.byteLength > maxBytes) {
    const maxSizeMB = maxBytes / (1024 * 1024);
    throw new TabularFileError(
      "file_too_large",
      `File is too large. Maximum size is ${maxSizeMB}MB.`,
    );
  }

  const kind = detectTabularFileKind({
    mediaType,
    filename,
    dataUrlMediaType: decoded.mediaType,
  });

  if (!kind) {
    throw new TabularFileError(
      "unsupported_file_type",
      "Unsupported spreadsheet format. Please upload CSV, TSV, XLSX, or XLS.",
    );
  }

  let sheets: ParsedTabularSheet[];
  if (kind === "csv" || kind === "tsv") {
    const text = removeUtf8Bom(decoded.data.toString("utf8"));
    const rows = parseDelimitedContent(text, kind === "tsv" ? "\t" : ",");
    sheets = [
      {
        name: toDisplaySheetName(filename),
        rows,
      },
    ];
  } else {
    sheets = parseWorkbook(decoded.data);
  }

  const warnings = sheets.flatMap((sheet) =>
    (sheet.warnings ?? []).map((warning) => `${sheet.name}: ${warning}`),
  );

  return {
    kind,
    fileSizeBytes: decoded.data.byteLength,
    mediaType: normalizeMimeType(mediaType) ?? decoded.mediaType,
    sheets,
    warnings,
  };
}

export function countNonEmptyRows(rows: string[][]): number {
  return rows.filter((row) => row.some((cell) => cell.trim() !== "")).length;
}

export function selectBestSheet<Metadata>(
  sheets: ParsedTabularSheet[],
  scoreSheet: (
    sheet: ParsedTabularSheet,
    sheetIndex: number,
  ) => SheetScoreResult<Metadata>,
): SelectedSheetResult<Metadata> {
  if (sheets.length === 0) {
    throw new TabularFileError(
      "invalid_tabular_file",
      "The spreadsheet is empty. Please upload a file with at least one sheet.",
    );
  }

  const scoredSheets = sheets.map((sheet, sheetIndex) => ({
    sheet,
    sheetIndex,
    ...scoreSheet(sheet, sheetIndex),
  }));

  scoredSheets.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.sheetIndex - right.sheetIndex;
  });

  const selected = scoredSheets[0];
  const warnings: string[] = [];

  if (sheets.length > 1) {
    warnings.push(`Selected sheet "${selected.sheet.name}" for import.`);
  }

  if (selected.confidence === "low") {
    warnings.push(
      `Sheet selection confidence is low for "${selected.sheet.name}". Please review extracted rows carefully.`,
    );
  }

  return {
    sheet: selected.sheet,
    sheetIndex: selected.sheetIndex,
    confidence: selected.confidence,
    metadata: selected.metadata,
    warnings,
  };
}

function escapeCsvCell(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function rowsToCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((value) => escapeCsvCell(value)).join(","))
    .join("\n");
}

export function buildAiTableText(
  rows: string[][],
  options: BuildAiTableTextOptions = {},
): BuildAiTableTextResult {
  const maxRows = options.maxRows ?? 250;
  const maxColumns = options.maxColumns ?? 40;
  const warnings: string[] = [];

  const limitedRows = rows
    .slice(0, maxRows)
    .map((row) => row.slice(0, maxColumns));
  if (rows.length > maxRows) {
    warnings.push(
      `Only the first ${maxRows} rows were sent to AI to keep extraction reliable.`,
    );
  }

  const maxDetectedColumns = rows.reduce(
    (maxValue, row) => Math.max(maxValue, row.length),
    0,
  );
  if (maxDetectedColumns > maxColumns) {
    warnings.push(
      `Only the first ${maxColumns} columns were sent to AI to keep extraction reliable.`,
    );
  }

  const text = limitedRows
    // Values are normalized upstream; keep this pass as a safety guard for
    // mixed input paths and future parser changes.
    .map((row) => row.map((value) => normalizeCellValue(value)).join("\t"))
    .join("\n");

  return {
    text,
    warnings,
    rowCount: rows.length,
    columnCount: maxDetectedColumns,
  };
}
