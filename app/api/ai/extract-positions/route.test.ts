import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

const generateTextMock = vi.fn();
const parsePositionsCSVMock = vi.fn();
const postProcessExtractedPositionsMock = vi.fn();

vi.mock("ai", () => ({
  generateText: generateTextMock,
  Output: {
    object: vi.fn(({ schema }) => ({ __kind: "object-output", schema })),
  },
}));

vi.mock("@/server/ai/provider", () => ({
  aiModel: vi.fn(() => "model"),
  extractionModelId: "gpt-5-mini",
}));

vi.mock("@/lib/import/positions/ai-extraction", () => ({
  createExtractionPrompt: vi.fn(async () => "extract positions prompt"),
  createExtractionResultSchema: vi.fn(async () => ({})),
  postProcessExtractedPositions: postProcessExtractedPositionsMock,
}));

vi.mock("@/lib/import/positions/parse-csv", () => ({
  parsePositionsCSV: parsePositionsCSVMock,
}));

function toDataUrl(content: string, mediaType: string): string {
  return `data:${mediaType};base64,${Buffer.from(content, "utf8").toString("base64")}`;
}

function createWorkbookDataUrl(input: {
  sheets: Array<{ name: string; rows: Array<Array<string | number>> }>;
  bookType?: "xlsx" | "xls";
}): { dataUrl: string; mediaType: string } {
  const workbook = XLSX.utils.book_new();

  for (const sheet of input.sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }

  const bookType = input.bookType ?? "xlsx";
  const mediaType =
    bookType === "xls"
      ? "application/vnd.ms-excel"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType,
  }) as Buffer;

  return {
    dataUrl: `data:${mediaType};base64,${buffer.toString("base64")}`,
    mediaType,
  };
}

async function callRoute(file: {
  url: string;
  mediaType: string;
  filename: string;
}): Promise<Response> {
  const { POST } = await import("@/app/api/ai/extract-positions/route");

  const request = new Request("http://localhost/api/ai/extract-positions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files: [file] }),
  });

  return POST(request);
}

describe("POST /api/ai/extract-positions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    generateTextMock.mockResolvedValue({ output: { success: true } });
    postProcessExtractedPositionsMock.mockResolvedValue({
      success: true,
      positions: [
        {
          name: "Apple Inc",
          category_id: "equity",
          currency: "USD",
          quantity: 10,
          unit_value: 120,
          cost_basis_per_unit: null,
          capital_gains_tax_rate: null,
          symbolLookup: "AAPL",
          description: null,
        },
      ],
    });
    parsePositionsCSVMock.mockResolvedValue({
      success: false,
      positions: [],
      errors: ["fallback parser should not be used in this test"],
    });
  });

  it("supports CSV in AI import without file-part rejection", async () => {
    const response = await callRoute({
      url: toDataUrl(
        "name,quantity,currency,unit_value\nApple Inc,10,USD,120\n",
        "text/csv",
      ),
      mediaType: "text/csv",
      filename: "positions.csv",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    expect(generateTextMock).toHaveBeenCalledTimes(1);
    const payload = generateTextMock.mock.calls[0][0];
    const content = payload.messages[0].content as Array<{
      type: string;
      text?: string;
    }>;

    expect(content.some((part) => part.type === "file")).toBe(false);
    expect(content[0]?.text ?? "").toContain(
      "name\tquantity\tcurrency\tunit_value",
    );
  });

  it("auto-selects the most relevant sheet for multi-sheet XLSX files", async () => {
    const workbook = createWorkbookDataUrl({
      sheets: [
        {
          name: "Summary",
          rows: [["Portfolio summary"], ["Total value", "10000"]],
        },
        {
          name: "Holdings",
          rows: [
            ["name", "quantity", "currency", "unit_value"],
            ["MSFT", 3, "USD", 400],
          ],
        },
      ],
    });

    const response = await callRoute({
      url: workbook.dataUrl,
      mediaType: workbook.mediaType,
      filename: "positions.xlsx",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    const payload = generateTextMock.mock.calls[0][0];
    const contentText = (payload.messages[0].content[0]?.text ?? "") as string;
    expect(contentText).toContain('sheet "Holdings"');
    expect(contentText).toContain("MSFT");
    expect(contentText).not.toContain("Portfolio summary");
  });

  it("falls back to deterministic parser when AI extraction fails for tabular files", async () => {
    postProcessExtractedPositionsMock.mockResolvedValueOnce({
      success: false,
      positions: [],
      errors: ["AI extraction failed"],
      warnings: ["low confidence"],
    });
    parsePositionsCSVMock.mockResolvedValueOnce({
      success: true,
      positions: [
        {
          name: "Apple Inc",
          category_id: "equity",
          currency: "USD",
          quantity: 10,
          unit_value: 120,
          cost_basis_per_unit: null,
          capital_gains_tax_rate: null,
          symbolLookup: "AAPL",
          description: null,
        },
      ],
      warnings: ["parsed via CSV parser"],
      symbolValidation: {},
      supportedCurrencies: ["USD", "EUR"],
    });

    const response = await callRoute({
      url: toDataUrl(
        "name,quantity,currency,unit_value\nApple Inc,10,USD,120\n",
        "text/csv",
      ),
      mediaType: "text/csv",
      filename: "positions.csv",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(parsePositionsCSVMock).toHaveBeenCalledTimes(1);
    expect((body.warnings ?? []).join(" ")).toContain(
      "deterministic spreadsheet parsing was used as fallback",
    );
  });

  it("returns structured errors for invalid spreadsheet files", async () => {
    const response = await callRoute({
      url: "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,Zm9v",
      mediaType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: "broken.xlsx",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect((body.errors ?? []).join(" ")).toMatch(
      /Invalid Excel file|does not contain enough rows/,
    );
  });

  it("returns size-limit errors for oversized tabular files", async () => {
    const oversized = "x".repeat(10 * 1024 * 1024 + 10);

    const response = await callRoute({
      url: toDataUrl(oversized, "text/csv"),
      mediaType: "text/csv",
      filename: "large.csv",
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect((body.errors ?? []).join(" ")).toContain("File is too large");
  });

  it("keeps non-tabular (PDF) extraction path unchanged", async () => {
    const response = await callRoute({
      url: "data:application/pdf;base64,JVBERi0xLjQK",
      mediaType: "application/pdf",
      filename: "statement.pdf",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    const payload = generateTextMock.mock.calls[0][0];
    const content = payload.messages[0].content as Array<{
      type: string;
      mediaType?: string;
    }>;
    expect(content.some((part) => part.type === "file")).toBe(true);
    expect(content.find((part) => part.type === "file")?.mediaType).toBe(
      "application/pdf",
    );
  });
});
