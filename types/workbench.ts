import type { BaseUrlMode } from "@/lib/config/runtime";

export type ImageKind = "generate" | "edit";

export type UploadedImage = {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  data: string;
  sourceImageId?: string;
};

export type GeneratedImage = {
  id: string;
  imageUrl: string;
  mimeType: string;
  prompt: string;
  model: string;
  createdAt: string;
  kind?: ImageKind;
};

export type HistoryImage = {
  id: string;
  imageUrl: string;
  mimeType: string;
  prompt?: string;
  model?: string;
  createdAt?: string;
  kind?: ImageKind;
};

export type HistoryItem = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  images?: HistoryImage[];
  prompt?: string;
  mimeType?: string;
  model?: string;
  createdAt?: string;
};

export type WorkbenchConfig = {
  baseUrlMode: BaseUrlMode;
  defaultBaseUrl: string;
  defaultModel: string;
};
