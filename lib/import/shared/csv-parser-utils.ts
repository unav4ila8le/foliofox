/**
 * Shared CSV/TSV Parsing Utilities
 *
 * These utilities are used by both position and portfolio record imports.
 * They handle delimiter detection and row parsing with proper quote handling.
 */

/**
 * Detect the delimiter used in a CSV/TSV file by scoring the first line.
 * Supports comma, tab, and semicolon delimiters.
 * @param content - Raw CSV/TSV text
 * @returns The detected delimiter: "," | "\t" | ";" (defaulting to ",")
 */
export function detectCSVDelimiter(content: string): string {
  const firstLine = content.split("\n")[0];

  const counts = {
    comma: (firstLine.match(/,/g) || []).length,
    tab: (firstLine.match(/\t/g) || []).length,
    semicolon: (firstLine.match(/;/g) || []).length,
  };

  // Determine the highest count
  const maxCount = Math.max(counts.comma, counts.tab, counts.semicolon);

  if (maxCount === 0) return ","; // Default fallback

  if (counts.tab === maxCount) return "\t";
  if (counts.semicolon === maxCount) return ";";
  return ",";
}

/**
 * Parse a single CSV row, handling quoted values and embedded delimiters.
 * Properly handles escaped quotes ("" becomes ") and values containing delimiters.
 * @param row - A single CSV line
 * @param delimiter - The delimiter to split by
 * @returns Array of clean string values
 */
export function parseCSVRowValues(row: string, delimiter: string): string[] {
  const values: string[] = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (char === '"') {
      if (insideQuotes && row[i + 1] === '"') {
        // Handle escaped quotes ("" becomes ")
        currentValue += '"';
        i++; // Skip the next quote
      } else {
        // Toggle quote state (entering or leaving quotes)
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      // End of value (delimiter outside quotes)
      values.push(currentValue.trim());
      currentValue = "";
    } else {
      // Regular character, add to current value
      currentValue += char;
    }
  }

  // Don't forget the last value
  values.push(currentValue.trim());

  return values;
}
