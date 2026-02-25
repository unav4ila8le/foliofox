/**
 * Split values into fixed-size chunks.
 */
export function chunkArray<T>(values: T[], size: number): T[][] {
  if (size <= 0) {
    return values.length ? [values.slice()] : [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}
