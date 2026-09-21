export type AiDecisionErrorCode =
  | "MISSING_API_KEY"
  | "GEMINI_UNAVAILABLE"
  | "GEMINI_UNAUTHORIZED"
  | "GEMINI_RATE_LIMIT"
  | "MODEL_UNAVAILABLE"
  | "EMPTY_RESPONSE"
  | "MALFORMED_RESPONSE"
  | "SCHEMA_VALIDATION"
  | "INVALID_CONTEXT";

export class AiDecisionError extends Error {
  readonly code: AiDecisionErrorCode;

  constructor(message: string, code: AiDecisionErrorCode, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiDecisionError";
    this.code = code;
  }
}

export function isAiDecisionError(error: unknown): error is AiDecisionError {
  return error instanceof AiDecisionError;
}

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  if ("status" in error && typeof error.status === "number") {
    return error.status;
  }

  if ("statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }

  return undefined;
}

export function mapGeminiError(error: unknown): AiDecisionError {
  if (isAiDecisionError(error)) {
    return error;
  }

  const status = readStatus(error);
  const message = error instanceof Error ? error.message : "Gemini request failed";
  const errorName = error instanceof Error ? error.name : "";

  if (
    errorName === "AbortError" ||
    errorName === "TimeoutError" ||
    /aborted|timeout|timed out/i.test(message)
  ) {
    return new AiDecisionError(
      message || "Gemini request timed out",
      "GEMINI_UNAVAILABLE",
      { cause: error }
    );
  }

  if (status === 401 || status === 403) {
    return new AiDecisionError(
      "Gemini rejected the request. Check GEMINI_API_KEY.",
      "GEMINI_UNAUTHORIZED",
      { cause: error }
    );
  }

  if (status === 404) {
    return new AiDecisionError(
      "The configured Gemini model is unavailable.",
      "MODEL_UNAVAILABLE",
      { cause: error }
    );
  }

  if (status === 429) {
    return new AiDecisionError("Gemini rate limit exceeded", "GEMINI_RATE_LIMIT", { cause: error });
  }

  if (status === 503 || status === 500 || /high demand|overloaded|try again later|unavailable/i.test(message)) {
    return new AiDecisionError(
      message || "Gemini is unavailable",
      "GEMINI_UNAVAILABLE",
      { cause: error }
    );
  }

  return new AiDecisionError(
    message || "Gemini is unavailable",
    "GEMINI_UNAVAILABLE",
    { cause: error }
  );
}

export function isRetryableGeminiError(error: unknown): boolean {
  const mapped = isAiDecisionError(error) ? error : mapGeminiError(error);

  return (
    mapped.code === "GEMINI_UNAVAILABLE" ||
    mapped.code === "GEMINI_RATE_LIMIT" ||
    mapped.code === "MODEL_UNAVAILABLE"
  );
}
