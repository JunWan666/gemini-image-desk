import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRuntimeConfig } from "@/lib/config/runtime";
import { isProviderError } from "@/lib/providers/errors";
import { listGeminiModels } from "@/lib/providers/gemini/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const modelsRequestSchema = z.object({
  apiKey: z.string().trim().min(1).max(4096),
  baseUrl: z.string().trim().max(2048).optional(),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("validation", "Request body must be valid JSON", 400);
  }

  const parsed = modelsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("validation", "Invalid model list request", 400);
  }

  const runtimeConfig = getRuntimeConfig();
  const requestedBaseUrl = parsed.data.baseUrl?.trim();
  const baseUrl =
    runtimeConfig.baseUrlMode === "public"
      ? requestedBaseUrl || runtimeConfig.defaultBaseUrl
      : runtimeConfig.defaultBaseUrl;

  try {
    const models = await listGeminiModels({
      apiKey: parsed.data.apiKey,
      baseUrl,
    });

    return NextResponse.json({ models });
  } catch (error) {
    if (isProviderError(error)) {
      return errorResponse(error.code, error.message, error.status);
    }

    return errorResponse("unknown", "Unexpected model list error", 500);
  }
}
