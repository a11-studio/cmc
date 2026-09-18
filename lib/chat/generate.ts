import { AiDecisionError, mapGeminiError } from "@/lib/ai/errors";
import { resolveGeminiModel } from "@/lib/ai/config";
import type { GeminiGenerateContent } from "@/lib/ai/types";

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() || trimmed;
}

export async function generateChatJson(
  input: {
    systemInstruction: string;
    userPrompt: string;
    schema: unknown;
  },
  options: { generateContent: GeminiGenerateContent; model?: string }
): Promise<unknown> {
  const model = options.model?.trim() || resolveGeminiModel();

  try {
    const response = await options.generateContent({
      model,
      contents: input.userPrompt,
      systemInstruction: input.systemInstruction,
      responseJsonSchema: input.schema,
    });
    const text = response.text?.trim();

    if (!text) {
      throw new AiDecisionError("Gemini returned an empty chat response", "EMPTY_RESPONSE");
    }

    return JSON.parse(extractJsonText(text)) as unknown;
  } catch (error) {
    if (error instanceof AiDecisionError) {
      throw error;
    }

    if (error instanceof SyntaxError) {
      throw new AiDecisionError("Gemini returned malformed chat JSON", "MALFORMED_RESPONSE", { cause: error });
    }

    throw mapGeminiError(error);
  }
}
