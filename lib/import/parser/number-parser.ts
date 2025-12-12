// Robust numeric parser for EU/US formats; returns NaN on invalid input
export function parseNumberStrict(raw: string): number {
  const input = (raw ?? "")
    .toString()
    .trim()
    .replace(/\u00A0/g, " "); // normalize spaces
  if (!input) return NaN;

  const hasComma = input.includes(",");
  const hasDot = input.includes(".");

  // Strip leading/trailing non-numeric characters (currency symbols, spaces, etc)
  let normalized = input
    .replace(/^[^\d\-\.,]*/g, "")
    .replace(/[^\d\.,]*$/g, "");

  // Check for unexpected characters in the middle of the input
  // Allow only: digits, leading minus, comma, dot, and spaces
  if (!/^-?[\d\s.,]*$/.test(normalized)) {
    return NaN;
  }

  if (hasComma && !hasDot) {
    // EU: "52.673,82" or "52673,82" (dots might be thousands)
    // But reject if multiple commas (e.g., "1,2,3,4")
    if ((normalized.match(/,/g) || []).length > 1) return NaN;
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (!hasComma && hasDot) {
    // US: "52,673.82" or "52673.82" (commas might be thousands)
    // But reject if multiple dots (e.g., "1.2.3.4")
    if ((normalized.match(/\./g) || []).length > 1) return NaN;
    normalized = normalized.replace(/,/g, "");
  } else if (hasComma && hasDot) {
    // Decide by last separator position
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    if (lastComma > lastDot) {
      // Comma decimal → remove dots as thousands, comma -> dot
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      // Dot decimal → remove commas as thousands
      normalized = normalized.replace(/,/g, "");
    }
  }

  // Strip remaining non-numeric chars (spaces and separators already validated)
  normalized = normalized.replace(/[\s]/g, "");

  // If nothing remains after stripping, it's invalid
  if (!normalized || normalized === "-" || normalized === ".") return NaN;

  const result = Number(normalized);
  return Number.isFinite(result) ? result : NaN;
}
