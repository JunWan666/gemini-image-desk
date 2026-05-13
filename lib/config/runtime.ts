export type BaseUrlMode = "public" | "managed";

export type RuntimeConfig = {
  baseUrlMode: BaseUrlMode;
  defaultBaseUrl: string;
  defaultModel: string;
};

const defaultGeminiBaseUrl = "https://generativelanguage.googleapis.com";
const defaultGeminiModel = "gemini-2.5-flash-image";

export function getRuntimeConfig(): RuntimeConfig {
  const publicBaseUrlConfig = process.env.PUBLIC_BASE_URL_CONFIG === "true";

  return {
    baseUrlMode: publicBaseUrlConfig ? "public" : "managed",
    defaultBaseUrl: process.env.GEMINI_BASE_URL || defaultGeminiBaseUrl,
    defaultModel: process.env.GEMINI_DEFAULT_MODEL || defaultGeminiModel,
  };
}
