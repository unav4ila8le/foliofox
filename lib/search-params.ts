export type SearchParams = Record<string, string | string[] | undefined>;

export function getSearchParam(
  searchParams: SearchParams | undefined,
  key: string,
): string | undefined {
  const value = searchParams?.[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export type SearchParamUpdates = Record<string, string | undefined | null>;

type SearchParamsLike = { toString: () => string };

export function buildSearchParams(
  currentParams: SearchParamsLike,
  updates: SearchParamUpdates,
): URLSearchParams {
  const params = new URLSearchParams(currentParams.toString());
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      params.delete(key);
      return;
    }
    params.set(key, value);
  });
  return params;
}
