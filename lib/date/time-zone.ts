type IntlWithSupportedValuesOf = typeof Intl & {
  supportedValuesOf?: (key: "timeZone") => string[];
};

export const TIME_ZONE_MODES = {
  AUTO: "auto",
  MANUAL: "manual",
} as const;

export type TimeZoneMode =
  (typeof TIME_ZONE_MODES)[keyof typeof TIME_ZONE_MODES];

export const AUTO_TIME_ZONE_VALUE = TIME_ZONE_MODES.AUTO;
const WELL_KNOWN_IANA_TIME_ZONE_ALIASES = new Set<string>(["UTC", "Etc/UTC"]);

let cachedSupportedTimeZones: string[] | null = null;

/**
 * Returns runtime-supported IANA timezone names.
 * Cached in module scope to avoid rebuilding large lists repeatedly.
 */
export function getSupportedIanaTimeZones(): string[] {
  if (cachedSupportedTimeZones) {
    return cachedSupportedTimeZones;
  }

  const supportedValuesOf = (Intl as IntlWithSupportedValuesOf)
    .supportedValuesOf;

  if (typeof supportedValuesOf !== "function") {
    cachedSupportedTimeZones = [];
    return cachedSupportedTimeZones;
  }

  cachedSupportedTimeZones = [...supportedValuesOf("timeZone")].sort((a, b) =>
    a.localeCompare(b),
  );
  return cachedSupportedTimeZones;
}

/**
 * Validate that an input is an IANA timezone supported by the current runtime.
 */
export function isValidIanaTimeZone(timeZone: string): boolean {
  const candidate = timeZone.trim();
  if (!candidate) {
    return false;
  }

  // Accept canonical UTC aliases even when supportedValuesOf omits aliases.
  if (WELL_KNOWN_IANA_TIME_ZONE_ALIASES.has(candidate)) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: candidate });
      return true;
    } catch {
      return false;
    }
  }

  // 1. Prefer exact membership checks when supportedValuesOf is available.
  const supportedTimeZones = getSupportedIanaTimeZones();
  if (supportedTimeZones.length > 0) {
    return supportedTimeZones.includes(candidate);
  }

  // 2. Fallback for runtimes without supportedValuesOf.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize an IANA timezone to runtime canonical form, or null if invalid.
 */
export function normalizeIanaTimeZone(timeZone: string): string | null {
  const candidate = timeZone.trim();
  if (!isValidIanaTimeZone(candidate)) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: candidate,
    }).resolvedOptions().timeZone;
  } catch {
    return candidate;
  }
}

/**
 * Resolve browser timezone and return normalized IANA value.
 * Returns null when timezone cannot be determined or validated.
 */
export function resolveBrowserTimeZone(): string | null {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!detected || typeof detected !== "string") {
    return null;
  }

  return normalizeIanaTimeZone(detected);
}

export function isValidTimeZoneMode(value: string): value is TimeZoneMode {
  return value === TIME_ZONE_MODES.AUTO || value === TIME_ZONE_MODES.MANUAL;
}
