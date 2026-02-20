export const CHAT_FILE_ACCEPT_PATTERNS = [
  "image/*",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
] as const;

export const CHAT_FILE_ACCEPT_ATTRIBUTE = CHAT_FILE_ACCEPT_PATTERNS.join(",");
export const MAX_CHAT_FILES_PER_MESSAGE = 3;
export const MAX_CHAT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const MAX_CHAT_FILE_SIZE_MB = Math.floor(
  MAX_CHAT_FILE_SIZE_BYTES / (1024 * 1024),
);

export function isAllowedChatFileMediaType(mediaType: string): boolean {
  const normalizedMediaType = mediaType.trim().toLowerCase();
  if (!normalizedMediaType) {
    return false;
  }

  return CHAT_FILE_ACCEPT_PATTERNS.some((pattern) => {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -1);
      return normalizedMediaType.startsWith(prefix);
    }

    return normalizedMediaType === pattern.toLowerCase();
  });
}

export function estimateDataUrlBytes(dataUrl: string): number | null {
  const base64MarkerIndex = dataUrl.indexOf(";base64,");
  if (base64MarkerIndex < 0) {
    return null;
  }

  const base64Payload = dataUrl.slice(base64MarkerIndex + ";base64,".length);
  if (!base64Payload) {
    return 0;
  }

  // Base64 payload length -> byte size.
  const padding = base64Payload.endsWith("==")
    ? 2
    : base64Payload.endsWith("=")
      ? 1
      : 0;

  return Math.floor((base64Payload.length * 3) / 4) - padding;
}
