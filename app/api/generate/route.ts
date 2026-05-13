import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRuntimeConfig } from "@/lib/config/runtime";
import { isProviderError } from "@/lib/providers/errors";
import { generateGeminiImages } from "@/lib/providers/gemini/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxReferenceImages = 4;
const maxImageBytes = 10 * 1024 * 1024;
const maxBase64Chars = Math.ceil((maxImageBytes * 4) / 3) + 128;

const generateRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(12_000),
  apiKey: z.string().trim().min(1).max(4096),
  baseUrl: z.string().trim().max(2048).optional(),
  model: z.string().trim().min(1).max(160),
  aspectRatio: z.enum([
    "1:1",
    "2:3",
    "3:2",
    "3:4",
    "4:3",
    "4:5",
    "5:4",
    "9:16",
    "16:9",
    "21:9",
  ]),
  imageSize: z.enum(["1K", "2K", "4K"]).default("1K"),
  outputCount: z.number().int().min(1).max(4),
  images: z
    .array(
      z.object({
        name: z.string().max(240).optional(),
        mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
        data: z.string().min(1).max(maxBase64Chars),
      }),
    )
    .max(maxReferenceImages)
    .default([]),
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

  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("validation", "Invalid generation request", 400);
  }

  const runtimeConfig = getRuntimeConfig();
  const requestedBaseUrl = parsed.data.baseUrl?.trim();
  const baseUrl =
    runtimeConfig.baseUrlMode === "public"
      ? requestedBaseUrl || runtimeConfig.defaultBaseUrl
      : runtimeConfig.defaultBaseUrl;

  try {
    const images = await generateGeminiImages({
      ...parsed.data,
      baseUrl,
    });

    return NextResponse.json({ images });
  } catch (error) {
    if (isProviderError(error)) {
      return errorResponse(error.code, error.message, error.status);
    }

    return errorResponse("unknown", "Unexpected generation error", 500);
  }
}
