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
