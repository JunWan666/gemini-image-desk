import { ProviderError, mapHttpStatusToProviderCode, redactSensitiveText } from "@/lib/providers/errors";
import type {
  GenerateImageInput,
  ListModelsInput,
  ProviderGeneratedImage,
  ProviderImageInput,
  ProviderModel,
  ProviderErrorCode,
} from "@/lib/providers/types";

type GeminiInlineData = {
  mimeType?: string;
  mime_type?: string;
  data?: string;
};

type GeminiPart = {
  text?: string;
  inlineData?: GeminiInlineData;
  inline_data?: GeminiInlineData;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
};

type GeminiErrorResponse = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type GeminiModel = {
  name?: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
};

type GeminiModelsResponse = {
  models?: GeminiModel[];
  nextPageToken?: string;
};

type OpenAiModel = {
  id?: string;
  object?: string;
  owned_by?: string;
};

type OpenAiModelsResponse = {
  data?: Array<OpenAiModel | string>;
};

type ModelAuthMode = "bearer" | "google";

type ModelEndpointCandidate = {
  url: string;
  auth: ModelAuthMode;
};

type ModelListFailure = {
  code: ProviderErrorCode;
  message: string;
  status: number;
};

const requestTimeoutMs = 120_000;

function makeId(prefix: string) {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeModelName(model: string) {
  return model.trim().replace(/^models\//, "");
}

function parseProviderBaseUrl(baseUrl: string) {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new ProviderError("validation", "Invalid Gemini Base URL", 400);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ProviderError("validation", "Gemini Base URL must use HTTP or HTTPS", 400);
  }

  url.search = "";
  url.hash = "";
  return url;
}

function normalizePath(pathname: string) {
  const path = pathname.replace(/\/+$/, "");
  return path === "/" ? "" : path;
}

function stripKnownApiVersion(pathname: string) {
  return pathname.replace(/\/v1(?:beta)?$/, "");
}

function buildVersionedResourceUrl(baseUrl: string, version: "v1" | "v1beta", resource: string) {
  const url = parseProviderBaseUrl(baseUrl);
  const root = stripKnownApiVersion(normalizePath(url.pathname));
  url.pathname = `${root}/${version}/${resource}`.replace(/\/{2,}/g, "/");
  return url.toString();
}

function buildDirectResourceUrl(baseUrl: string, resource: string) {
  const url = parseProviderBaseUrl(baseUrl);
  const root = normalizePath(url.pathname);
  url.pathname = `${root}/${resource}`.replace(/\/{2,}/g, "/");
  return url.toString();
}

function getGeminiApiRoot(baseUrl: string) {
  const url = parseProviderBaseUrl(baseUrl);
  const path = url.pathname.replace(/\/+$/, "");
  const apiRoot = /\/v1(beta)?$/.test(path) ? path : `${path}/v1beta`;
  url.pathname = apiRoot;

  return url;
}

export function buildGeminiGenerateUrl(baseUrl: string, model: string) {
  const url = getGeminiApiRoot(baseUrl);
  const apiRoot = url.pathname.replace(/\/+$/, "");
  url.pathname = `${apiRoot}/models/${normalizeModelName(model)}:generateContent`.replace(
    /\/{2,}/g,
    "/",
  );

  return url.toString();
}

export function buildGeminiModelsUrl(baseUrl: string, pageToken?: string) {
  const url = getGeminiApiRoot(baseUrl);
  const apiRoot = url.pathname.replace(/\/+$/, "");
  url.pathname = `${apiRoot}/models`.replace(/\/{2,}/g, "/");
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  return url.toString();
}

export function buildOpenAiModelsUrl(baseUrl: string) {
  return buildVersionedResourceUrl(baseUrl, "v1", "models");
}

function toGeminiImagePart(image: ProviderImageInput): GeminiPart {
  return {
    inlineData: {
      mimeType: image.mimeType,
      data: image.data,
    },
  };
}

function buildRequestBody(input: GenerateImageInput) {
  const imageConfig: { aspectRatio: string; imageSize?: string } = {
    aspectRatio: input.aspectRatio,
  };

  if (/gemini-3/i.test(input.model)) {
    imageConfig.imageSize = input.imageSize;
  }

  return {
    contents: [
      {
        role: "user",
        parts: [{ text: input.prompt }, ...input.images.map(toGeminiImagePart)],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      responseFormat: {
        image: imageConfig,
      },
    },
  };
}

async function readGeminiError(response: Response, apiKey: string) {
  let message = `Gemini request failed with HTTP ${response.status}`;

  try {
    const payload = (await response.json()) as GeminiErrorResponse;
    if (payload.error?.message) {
      message = payload.error.message;
    }
  } catch {
    // Keep the generic HTTP message when the provider returns a non-JSON body.
  }

  throw new ProviderError(
    mapHttpStatusToProviderCode(response.status),
    redactSensitiveText(message, apiKey),
    response.status,
  );
}

function normalizeProviderModel(model: GeminiModel): ProviderModel | null {
  if (!model.name) return null;

  const id = normalizeModelName(model.name);
  return {
    id,
    name: model.name,
    displayName: model.displayName,
    description: model.description,
    supportedGenerationMethods: model.supportedGenerationMethods ?? [],
  };
}

function normalizeOpenAiProviderModel(model: OpenAiModel | string): ProviderModel | null {
  const id = typeof model === "string" ? model : model.id;
  if (!id) return null;

  const owner = typeof model === "string" ? undefined : model.owned_by;
  return {
    id,
    name: id,
    displayName: id,
    description: owner ? `Owned by ${owner}` : undefined,
    supportedGenerationMethods: [],
  };
}

function normalizeGeminiModelPayload(payload: GeminiModelsResponse) {
  const models: ProviderModel[] = [];

  for (const model of payload.models ?? []) {
    const normalized = normalizeProviderModel(model);
    if (normalized && isGenerateContentModel(normalized)) {
      models.push(normalized);
    }
  }

  return models;
}

function normalizeOpenAiModelPayload(payload: OpenAiModelsResponse) {
  const models: ProviderModel[] = [];

  for (const model of payload.data ?? []) {
    const normalized = normalizeOpenAiProviderModel(model);
    if (normalized) {
      models.push(normalized);
    }
  }

  return models;
}

function normalizeModelPayload(payload: GeminiModelsResponse & OpenAiModelsResponse) {
  return [
    ...normalizeGeminiModelPayload(payload),
    ...normalizeOpenAiModelPayload(payload),
  ];
}

function isGenerateContentModel(model: ProviderModel) {
  return (
    model.supportedGenerationMethods.length === 0 ||
    model.supportedGenerationMethods.includes("generateContent")
  );
}

function prioritizeImageModels(models: ProviderModel[]) {
  const uniqueModels = Array.from(
    new Map(models.map((model) => [model.id, model])).values(),
  );
  const imageModels = uniqueModels.filter(isImageLikelyModel);

  return imageModels.length ? imageModels : uniqueModels;
}

function isImageLikelyModel(model: ProviderModel) {
  const haystack = [model.id, model.displayName, model.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    haystack.includes("image") ||
    haystack.includes("imagen") ||
    haystack.includes("banana")
  );
}

function getInlineData(part: GeminiPart) {
  return part.inlineData ?? part.inline_data;
}

function extractImages(
  response: GeminiResponse,
  input: GenerateImageInput,
): ProviderGeneratedImage[] {
  const images: ProviderGeneratedImage[] = [];

  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const inlineData = getInlineData(part);
      if (!inlineData?.data) continue;

      const mimeType = inlineData.mimeType ?? inlineData.mime_type ?? "image/png";
      images.push({
        id: makeId("image"),
        imageUrl: `data:${mimeType};base64,${inlineData.data}`,
        mimeType,
        prompt: input.prompt,
        model: input.model,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return images;
}

async function callGeminiOnce(input: GenerateImageInput) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(buildGeminiGenerateUrl(input.baseUrl, input.model), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      body: JSON.stringify(buildRequestBody(input)),
      signal: controller.signal,
    });

    if (!response.ok) {
      await readGeminiError(response, input.apiKey);
    }

    const payload = (await response.json()) as GeminiResponse;
    const images = extractImages(payload, input);

    if (!images.length && payload.promptFeedback?.blockReason) {
      throw new ProviderError(
        "model",
        `Gemini blocked the request: ${payload.promptFeedback.blockReason}`,
        400,
      );
    }

    return images;
  } catch (error) {
    if (error instanceof ProviderError) throw error;

    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError("network", "Gemini request timed out", 504);
    }

    const message = error instanceof Error ? error.message : "Gemini network request failed";
    throw new ProviderError("network", redactSensitiveText(message, input.apiKey), 502);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateGeminiImages(input: GenerateImageInput) {
  const targetCount = Math.min(Math.max(input.outputCount, 1), 4);
  const images: ProviderGeneratedImage[] = [];

  for (let index = 0; index < targetCount; index += 1) {
    const nextImages = await callGeminiOnce(input);
    images.push(...nextImages);
    if (images.length >= targetCount) break;
  }

  if (!images.length) {
    throw new ProviderError("no_image", "Gemini did not return any image data", 502);
  }

  return images.slice(0, targetCount);
}

function buildModelEndpointCandidates(baseUrl: string): ModelEndpointCandidate[] {
  const candidates: ModelEndpointCandidate[] = [
    { url: buildOpenAiModelsUrl(baseUrl), auth: "bearer" },
    { url: buildOpenAiModelsUrl(baseUrl), auth: "google" },
    { url: buildGeminiModelsUrl(baseUrl), auth: "google" },
    { url: buildVersionedResourceUrl(baseUrl, "v1beta", "models"), auth: "google" },
    { url: buildDirectResourceUrl(baseUrl, "models"), auth: "bearer" },
  ];
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = `${candidate.auth}:${candidate.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildModelListHeaders(apiKey: string, auth: ModelAuthMode): Record<string, string> {
  if (auth === "bearer") {
    return {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
  }

  return {
    Accept: "application/json",
    "x-goog-api-key": apiKey,
  };
}

function extractProviderErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";

  const data = payload as {
    error?: string | { message?: string; status?: string; type?: string };
    message?: string;
    detail?: string;
  };

  if (typeof data.error === "string") return data.error;
  if (data.error?.message) return data.error.message;
  if (data.error?.status) return data.error.status;
  if (data.error?.type) return data.error.type;
  if (data.message) return data.message;
  if (data.detail) return data.detail;

  return "";
}

async function readModelListFailure(response: Response, apiKey: string): Promise<ModelListFailure> {
  let message = `Model list request failed with HTTP ${response.status}`;

  try {
    const text = await response.text();
    if (text) {
      const payload = JSON.parse(text) as unknown;
      message = extractProviderErrorMessage(payload) || message;
    }
  } catch {
    // Keep the generic HTTP message when the provider returns a non-JSON body.
  }

  return {
    code: mapHttpStatusToProviderCode(response.status),
    message: redactSensitiveText(message, apiKey),
    status: response.status,
  };
}

function selectModelListFailure(failures: ModelListFailure[]) {
  return (
    failures.find((failure) => failure.code === "auth") ??
    failures.find((failure) => failure.code === "rate_limit") ??
    failures.find((failure) => failure.code === "network") ??
    failures.find((failure) => failure.code === "validation") ??
    failures[0]
  );
}

async function fetchModelCandidate(
  input: ListModelsInput,
  candidate: ModelEndpointCandidate,
  signal: AbortSignal,
) {
  const models: ProviderModel[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 8; page += 1) {
    const url = new URL(candidate.url);
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url, {
      method: "GET",
      headers: buildModelListHeaders(input.apiKey, candidate.auth),
      signal,
    });

    if (!response.ok) {
      return { models: [], failure: await readModelListFailure(response, input.apiKey) };
    }

    const payload = (await response.json()) as GeminiModelsResponse & OpenAiModelsResponse;
    models.push(...normalizeModelPayload(payload));

    pageToken = payload.nextPageToken;
    if (!pageToken) break;
  }

  return { models, failure: undefined };
}

export async function listGeminiModels(input: ListModelsInput) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  const models: ProviderModel[] = [];
  const failures: ModelListFailure[] = [];

  try {
    for (const candidate of buildModelEndpointCandidates(input.baseUrl)) {
      const result = await fetchModelCandidate(input, candidate, controller.signal);
      if (result.failure) {
        failures.push(result.failure);
        continue;
      }

      if (result.models.length) {
        models.push(...result.models);
        break;
      }
    }
  } catch (error) {
    if (error instanceof ProviderError) throw error;

    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError("network", "Gemini model list request timed out", 504);
    }

    const message = error instanceof Error ? error.message : "Gemini model list failed";
    throw new ProviderError("network", redactSensitiveText(message, input.apiKey), 502);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!models.length && failures.length) {
    const failure = selectModelListFailure(failures);
    throw new ProviderError(failure.code, failure.message, failure.status);
  }

  return prioritizeImageModels(models);
}
