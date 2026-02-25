import { describe, expect, it } from "vitest";

import { chunkArray } from "./chunk-array";

describe("chunkArray", () => {
  it("returns evenly chunked arrays for positive size", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns one copied chunk when size is non-positive and array is non-empty", () => {
    const source = [1, 2, 3];
    const result = chunkArray(source, 0);

    expect(result).toEqual([[1, 2, 3]]);
    expect(result[0]).not.toBe(source);
  });

  it("returns empty array when source array is empty", () => {
    expect(chunkArray([], 3)).toEqual([]);
    expect(chunkArray([], 0)).toEqual([]);
  });
});
