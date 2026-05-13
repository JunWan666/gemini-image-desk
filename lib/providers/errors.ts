import type { ProviderErrorCode } from "@/lib/providers/types";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly status: number;

  constructor(code: ProviderErrorCode, message: string, status = 500) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.status = status;
  }
}

export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}

export function redactSensitiveText(message: string, apiKey?: string) {
  let redacted = message
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted-api-key]")
    .replace(/([?&]key=)[^&\s]+/gi, "$1[redacted-api-key]");

  if (apiKey) {
    redacted = redacted.split(apiKey).join("[redacted-api-key]");
  }

  return redacted;
}

export function mapHttpStatusToProviderCode(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "model";
  if (status === 408 || status === 504) return "network";
  if (status === 429) return "rate_limit";
  if (status >= 400 && status < 500) return "validation";
  if (status >= 500) return "model";
  return "unknown";
}
