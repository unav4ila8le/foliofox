/**
 * Shared Import Types
 *
 * Types used by both position and portfolio record imports.
 */

/**
 * Result type for import server actions.
 * Used by both position and portfolio record imports.
 */
export type ImportActionResult =
  | {
      success: true;
      importedCount: number;
      createdPositionCount?: number;
      matchedPositionCount?: number;
      skippedCount?: number;
      warnings?: string[];
    }
  | { success: false; error: string };
