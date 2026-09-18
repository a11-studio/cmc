import { GoogleGenAI } from "@google/genai";
import { AiDecisionError, mapGeminiError } from "@/lib/ai/errors";
import type { GeminiGenerateContent } from "@/lib/ai/types";

export function createGeminiClient(apiKey: string): GeminiGenerateContent {
  const key = apiKey.trim();

  if (!key) {
    throw new AiDecisionError("GEMINI_API_KEY is not configured", "MISSING_API_KEY");
  }

  const ai = new GoogleGenAI({ apiKey: key });

  return async (request) => {
    try {
      const response = await ai.models.generateContent({
        model: request.model,
        contents: request.contents,
        config: {
          systemInstruction: request.systemInstruction,
          responseMimeType: "application/json",
          responseJsonSchema: request.responseJsonSchema,
        },
      });

      return { text: response.text };
    } catch (error) {
      throw mapGeminiError(error);
    }
  };
}
