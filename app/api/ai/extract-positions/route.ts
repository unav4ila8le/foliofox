import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";

import {
  createExtractionResultSchema,
  createExtractionPrompt,
  postProcessExtractedPositions,
  type ExtractionResult,
} from "@/lib/import/sources/ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { files } = await req.json();
  if (!files?.[0]?.url)
    return Response.json(
      { success: false, errors: ["No file provided"] },
      { status: 400 },
    );

  const { url, mediaType } = files[0];

  // Guard: AI SDK does not support text/csv or TSV file parts
  if (
    mediaType?.startsWith("text/csv") ||
    mediaType === "text/tab-separated-values"
  ) {
    return Response.json(
      {
        success: false,
        errors: [
          "CSV/TSV is not supported in AI import. Please use the CSV import tab.",
        ],
      },
      { status: 400 },
    );
  }

  const [extractionPrompt, schema] = await Promise.all([
    createExtractionPrompt(),
    createExtractionResultSchema(),
  ]);

  const result = await generateObject({
    model: openai("gpt-4o-mini"),
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: extractionPrompt },
          { type: "file", data: url, mediaType },
        ],
      },
    ],
    schema,
  });

  const processed = await postProcessExtractedPositions(
    result.object as ExtractionResult,
  );
  return Response.json(processed);
}
