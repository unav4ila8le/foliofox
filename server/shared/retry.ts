const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 250;
const DEFAULT_MAX_DELAY_MS = 2_000;
const DEFAULT_JITTER_MS = 100;

// Heuristics for errors that are usually temporary and safe to retry.
const TRANSIENT_ERROR_PATTERNS = [
  /\b5\d{2}\b/i,
  /bad gateway/i,
  /timeout/i,
  /timed out/i,
  /network/i,
  /fetch failed/i,
  /temporarily unavailable/i,
  /econnreset/i,
  /econnrefused/i,
  /enotfound/i,
  /eai_again/i,
  /etimedout/i,
  /connection.*(reset|closed|terminated)/i,
];

export interface RetryAttemptContext {
  attempt: number;
  delayMs: number;
  error: unknown;
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterMs?: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (context: RetryAttemptContext) => void;
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractStatusCode(error: unknown): number | null {
  if (!isObjectLike(error)) return null;

  // Support both `status` (Fetch-style) and `statusCode` (Node/client libs).
  const status = error.status;
  if (typeof status === "number") return status;

  const statusCode = error.statusCode;
  if (typeof statusCode === "number") return statusCode;

  return null;
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (isObjectLike(error) && typeof error.message === "string") {
    return error.message;
  }
  return String(error);
}

function resolveDelayMs(params: {
  attempt: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMs: number;
}): number {
  const { attempt, baseDelayMs, maxDelayMs, jitterMs } = params;
  // 250ms, 500ms, 1000ms, ... capped by maxDelayMs.
  const exponentialDelay = Math.min(
    maxDelayMs,
    baseDelayMs * 2 ** Math.max(0, attempt - 1),
  );
  // Add jitter so concurrent retries don't all happen at the same moment.
  const jitter = jitterMs > 0 ? Math.floor(Math.random() * (jitterMs + 1)) : 0;
  return exponentialDelay + jitter;
}

function sleep(delayMs: number): Promise<void> {
  if (delayMs <= 0) return Promise.resolve();

  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export function isTransientError(error: unknown): boolean {
  const statusCode = extractStatusCode(error);
  // Most upstream 5xx responses are transient and worth retrying.
  if (statusCode !== null && statusCode >= 500 && statusCode <= 599) {
    return true;
  }

  const serialized = stringifyError(error);
  return TRANSIENT_ERROR_PATTERNS.some((pattern) => pattern.test(serialized));
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  // Normalize external input so retry behavior is predictable.
  const maxAttempts = Math.max(
    1,
    Math.trunc(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS),
  );
  const baseDelayMs = Math.max(
    0,
    Math.trunc(options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS),
  );
  const maxDelayMs = Math.max(
    0,
    Math.trunc(options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS),
  );
  const jitterMs = Math.max(
    0,
    Math.trunc(options.jitterMs ?? DEFAULT_JITTER_MS),
  );
  const shouldRetry = options.shouldRetry ?? isTransientError;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isFinalAttempt = attempt >= maxAttempts;
      // Stop immediately on non-transient failures or final attempt.
      if (isFinalAttempt || !shouldRetry(error)) {
        throw error;
      }

      const delayMs = resolveDelayMs({
        attempt,
        baseDelayMs,
        maxDelayMs,
        jitterMs,
      });

      options.onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs);
    }
  }

  // Defensive fallback: loop should have returned/thrown earlier.
  throw lastError;
}
