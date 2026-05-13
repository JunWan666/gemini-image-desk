export type ProviderImageInput = {
  name?: string;
  mimeType: string;
  data: string;
};

export type GenerateImageInput = {
  prompt: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  aspectRatio: string;
  imageSize: string;
  outputCount: number;
  images: ProviderImageInput[];
};

export type ListModelsInput = {
  apiKey: string;
  baseUrl: string;
};

export type ProviderGeneratedImage = {
  id: string;
  imageUrl: string;
  mimeType: string;
  prompt: string;
  model: string;
  createdAt: string;
};

export type ProviderModel = {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods: string[];
};

export type ProviderErrorCode =
  | "auth"
  | "network"
  | "model"
  | "validation"
  | "no_image"
  | "rate_limit"
  | "unknown";
