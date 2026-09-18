import type { PaperTradingErrorCode } from "@/lib/paper/types";

export class PaperTradingError extends Error {
  readonly code: PaperTradingErrorCode;

  constructor(message: string, code: PaperTradingErrorCode) {
    super(message);
    this.name = "PaperTradingError";
    this.code = code;
  }
}

export function isPaperTradingError(error: unknown): error is PaperTradingError {
  return error instanceof PaperTradingError;
}
