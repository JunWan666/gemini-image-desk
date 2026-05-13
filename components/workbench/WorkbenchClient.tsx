"use client";

import {
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Download,
  ExternalLink,
  Check,
  ImagePlus,
  Maximize2,
  Moon,
  RotateCcw,
  Save,
  Search,
  Send,
  Square,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type ClipboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  defaultLocale,
  dictionaries,
  type I18nKey,
  type Locale,
} from "@/lib/i18n/dictionaries";
import type {
  GeneratedImage,
  HistoryImage,
  HistoryItem,
  ImageKind,
  UploadedImage,
  WorkbenchConfig,
} from "@/types/workbench";

type GenerationStatus = "idle" | "running" | "error" | "success";

type SettingsSnapshot = {
  locale?: Locale;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  imageSize?: string;
  theme?: ThemeMode;
  themePreferenceSet?: boolean;
};

type GenerateResponse =
  | { images: GeneratedImage[] }
  | { error: { code?: string; message?: string } };

type ModelsResponse =
  | { models: ModelOption[] }
  | { error: { code?: string; message?: string } };

type ModelFetchStatus = "idle" | "loading" | "success" | "empty" | "error";
type ThemeMode = "light" | "dark";
type MobileView = "compose" | "setup" | "output" | "history";

type ModelOption = {
  id: string;
  displayName?: string;
  description?: string;
};

type PresetId =
  | "characterSheet"
  | "mangaLineart"
  | "lockScreen"
  | "moviePoster";

type PresetOption = {
  id: PresetId;
  labelKey: I18nKey;
  promptKey: I18nKey;
  mode: "text" | "reference";
  referenceKey?: I18nKey;
  code: string;
};

type PreviewImage = {
  id?: string;
  kind: "result" | "reference";
  src: string;
  alt: string;
  mimeType?: string;
};

const settingsKey = "gemini-image-desk.settings.v1";
const historyKey = "gemini-image-desk.history.v1";
const historyDbName = "gemini-image-desk";
const historyStoreName = "history";
const maxReferenceImages = 4;
const maxImageBytes = 10 * 1024 * 1024;
const acceptedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const inspirationUrl = "https://github.com/PicoTrex/Awesome-Nano-Banana-images";

const fallbackModelOptions: ModelOption[] = [
  { id: "gemini-2.5-flash-image" },
  { id: "gemini-3-pro-image-preview" },
  { id: "gemini-2.5-flash-image-preview" },
];

const presetOptions: PresetOption[] = [
  {
    id: "lockScreen",
    labelKey: "preset.lockScreen",
    promptKey: "presetPrompt.lockScreen",
    mode: "text",
    code: "01",
  },
  {
    id: "moviePoster",
    labelKey: "preset.moviePoster",
    promptKey: "presetPrompt.moviePoster",
    mode: "text",
    code: "02",
  },
  {
    id: "characterSheet",
    labelKey: "preset.characterSheet",
    promptKey: "presetPrompt.characterSheet",
    mode: "reference",
    referenceKey: "presetReference.characterSheet",
    code: "03",
  },
  {
    id: "mangaLineart",
    labelKey: "preset.mangaLineart",
    promptKey: "presetPrompt.mangaLineart",
    mode: "reference",
    referenceKey: "presetReference.mangaLineart",
    code: "04",
  },
];

const defaultPrompt =
  "把这张产品图放在干净白底上，保留真实阴影，生成电商主图风格。";

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function readFileAsImage(file: File): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const parsed = parseDataUrl(dataUrl);
      if (!parsed) {
        reject(new Error(`Unsupported image data for ${file.name}`));
        return;
      }

      resolve({
        id: makeId("upload"),
        name: file.name,
        mimeType: parsed.mimeType,
        dataUrl,
        data: parsed.data,
      });
    };
    reader.readAsDataURL(file);
  });
}

function getFileExtension(mimeType: string) {
  if (mimeType.includes("jpeg")) return "jpg";
  return mimeType.split("/")[1]?.split(";")[0] || "png";
}

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && value in dictionaries;
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

function isI18nKey(key: string): key is I18nKey {
  return key in dictionaries[defaultLocale];
}

function normalizeImageKind(value: unknown): ImageKind {
  return value === "edit" ? "edit" : "generate";
}

function sanitizeHistoryImages(value: unknown): HistoryImage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((image): HistoryImage | null => {
      if (!image || typeof image !== "object") return null;
      const maybeImage = image as Partial<HistoryImage>;
      if (
        typeof maybeImage.id !== "string" ||
        typeof maybeImage.imageUrl !== "string" ||
        !maybeImage.imageUrl.startsWith("data:image/")
      ) {
        return null;
      }

      return {
        ...maybeImage,
        id: maybeImage.id,
        imageUrl: maybeImage.imageUrl,
        mimeType:
          maybeImage.mimeType ??
          parseDataUrl(maybeImage.imageUrl)?.mimeType ??
          "image/png",
        kind: normalizeImageKind(maybeImage.kind),
      };
    })
    .filter((image): image is HistoryImage => Boolean(image))
    .slice(0, 12);
}

function sanitizeHistory(value: unknown): HistoryItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): HistoryItem | null => {
      if (!item || typeof item !== "object") return null;
      const maybeItem = item as Partial<HistoryItem>;
      if (
        typeof maybeItem.id === "string" &&
        typeof maybeItem.title === "string" &&
        typeof maybeItem.subtitle === "string"
      ) {
        const images = sanitizeHistoryImages(maybeItem.images);
        if (images.length) {
          return {
            ...maybeItem,
            id: maybeItem.id,
            title: maybeItem.title,
            subtitle: maybeItem.subtitle,
            imageUrl: maybeItem.imageUrl ?? images[0].imageUrl,
            images,
          };
        }

        if (
          typeof maybeItem.imageUrl === "string" &&
          maybeItem.imageUrl.startsWith("data:image/")
        ) {
          return {
            ...maybeItem,
            id: maybeItem.id,
            title: maybeItem.title,
            subtitle: maybeItem.subtitle,
            images: [
              {
                id: maybeItem.id,
                imageUrl: maybeItem.imageUrl,
                mimeType:
                  maybeItem.mimeType ??
                  parseDataUrl(maybeItem.imageUrl)?.mimeType ??
                  "image/png",
                prompt: maybeItem.prompt ?? maybeItem.title,
                model: maybeItem.model,
                createdAt: maybeItem.createdAt,
                kind: "generate",
              },
            ],
          };
        }
      }

      return null;
    })
    .filter((item): item is HistoryItem => Boolean(item))
    .slice(0, 20);
}

function getHistoryTimestamp(item: HistoryItem) {
  return Date.parse(item.createdAt ?? "") || 0;
}

function getHistoryImages(item: HistoryItem): HistoryImage[] {
  const images = sanitizeHistoryImages(item.images);
  if (images.length) return images;

  if (item.imageUrl) {
    return [
      {
        id: item.id,
        imageUrl: item.imageUrl,
        mimeType: item.mimeType ?? parseDataUrl(item.imageUrl)?.mimeType ?? "image/png",
        prompt: item.prompt ?? item.title,
        model: item.model,
        createdAt: item.createdAt,
        kind: "generate",
      },
    ];
  }

  return [];
}

function historyImageToGeneratedImage(
  image: HistoryImage,
  item: HistoryItem,
  fallbackModel: string,
): GeneratedImage {
  return {
    id: image.id,
    imageUrl: image.imageUrl,
    mimeType: image.mimeType ?? parseDataUrl(image.imageUrl)?.mimeType ?? "image/png",
    prompt: image.prompt ?? item.prompt ?? item.title,
    model: image.model ?? item.model ?? fallbackModel,
    createdAt: image.createdAt ?? item.createdAt ?? new Date().toISOString(),
    kind: normalizeImageKind(image.kind),
  };
}

function openHistoryDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(historyDbName, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(historyStoreName)) {
        database.createObjectStore(historyStoreName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open image history"));
  });
}

async function loadHistoryFromIndexedDb() {
  const database = await openHistoryDatabase();
  if (!database) return [];

  return new Promise<HistoryItem[]>((resolve, reject) => {
    const transaction = database.transaction(historyStoreName, "readonly");
    const request = transaction.objectStore(historyStoreName).getAll();

    request.onsuccess = () => {
      resolve(
        sanitizeHistory(request.result)
          .sort((left, right) => getHistoryTimestamp(right) - getHistoryTimestamp(left))
          .slice(0, 20),
      );
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to load image history"));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => database.close();
  });
}

async function saveHistoryToIndexedDb(items: HistoryItem[]) {
  const database = await openHistoryDatabase();
  if (!database) return false;

  return new Promise<boolean>((resolve, reject) => {
    const transaction = database.transaction(historyStoreName, "readwrite");
    const store = transaction.objectStore(historyStoreName);

    store.clear();
    for (const item of items.slice(0, 20)) {
      store.put(item);
    }

    transaction.oncomplete = () => {
      database.close();
      resolve(true);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Failed to save image history"));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Failed to save image history"));
    };
  });
}

export function WorkbenchClient({ config }: { config: WorkbenchConfig }) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [themePreferenceSet, setThemePreferenceSet] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(config.defaultBaseUrl);
  const [model, setModel] = useState(config.defaultModel);
  const [availableModels, setAvailableModels] =
    useState<ModelOption[]>(fallbackModelOptions);
  const [modelFetchStatus, setModelFetchStatus] =
    useState<ModelFetchStatus>("idle");
  const [modelFetchError, setModelFetchError] = useState("");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [imageSize, setImageSize] = useState("1K");
  const [outputCount, setOutputCount] = useState(1);
  const [references, setReferences] = useState<UploadedImage[]>([]);
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historySearchOpen, setHistorySearchOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetId | null>(null);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [mobileView, setMobileView] = useState<MobileView>("compose");
  const [connectionSaved, setConnectionSaved] = useState(false);
  const [activeOperation, setActiveOperation] = useState<ImageKind>("generate");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generationStartedAtRef = useRef<number | null>(null);
  const connectionSavedTimerRef = useRef<number | null>(null);

  const dictionary = dictionaries[locale];
  const t = (key: I18nKey) => dictionary[key];
  const isPublicMode = config.baseUrlMode === "public";
  const getImageKindLabel = (kind?: ImageKind) =>
    t(normalizeImageKind(kind) === "edit" ? "badge.edit" : "badge.generate");

  const saveSettingsSnapshot = () => {
    const snapshot: SettingsSnapshot = {
      locale,
      baseUrl: isPublicMode ? baseUrl : undefined,
      model,
      imageSize,
      apiKey,
      theme,
      themePreferenceSet,
    };
    localStorage.setItem(settingsKey, JSON.stringify(snapshot));
  };

  const handleSaveConnection = () => {
    saveSettingsSnapshot();
    setConnectionSaved(true);
    if (connectionSavedTimerRef.current) {
      window.clearTimeout(connectionSavedTimerRef.current);
    }
    connectionSavedTimerRef.current = window.setTimeout(() => {
      setConnectionSaved(false);
      connectionSavedTimerRef.current = null;
    }, 4200);
  };

  const selectedResult = useMemo(
    () => results.find((result) => result.id === selectedResultId) ?? results[0],
    [results, selectedResultId],
  );

  const selectedResultIndex = useMemo(() => {
    if (!selectedResult) return -1;
    return results.findIndex((result) => result.id === selectedResult.id);
  }, [results, selectedResult]);

  const modelSelectOptions = useMemo(() => {
    const byId = new Map<string, ModelOption>();

    for (const item of availableModels) {
      byId.set(item.id, item);
    }
    if (model && !byId.has(model)) {
      byId.set(model, { id: model });
    }

    return Array.from(byId.values());
  }, [availableModels, model]);

  const filteredHistory = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) return history;

    return history.filter((item) =>
      [
        item.title,
        item.prompt,
        item.model,
        item.subtitle,
        ...getHistoryImages(item).flatMap((image) => [
          image.model,
          image.prompt,
          image.kind,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [history, historyQuery]);

  const translatedError = useMemo(() => {
    if (!error) return "";
    const key = `apiError.${error}` as I18nKey;
    return isI18nKey(key) ? t(key) : error;
  }, [error, t]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    try {
      const storedSettings = localStorage.getItem(settingsKey);
      if (storedSettings) {
        const settings = JSON.parse(storedSettings) as SettingsSnapshot;
        if (isLocale(settings.locale)) {
          setLocale(settings.locale);
          document.documentElement.lang = settings.locale;
        }
        if (settings.apiKey) {
          setApiKey(settings.apiKey);
        }
        if (isPublicMode && settings.baseUrl) {
          setBaseUrl(settings.baseUrl);
        }
        if (settings.model) {
          setModel(settings.model);
        }
        if (settings.imageSize) {
          setImageSize(settings.imageSize);
        }
        if (settings.themePreferenceSet && isThemeMode(settings.theme)) {
          setTheme(settings.theme);
          setThemePreferenceSet(true);
          document.documentElement.dataset.theme = settings.theme;
        }
      }

      const storedHistory = localStorage.getItem(historyKey);
      if (storedHistory) {
        setHistory(sanitizeHistory(JSON.parse(storedHistory)));
      }

      void loadHistoryFromIndexedDb()
        .then((storedItems) => {
          if (cancelled) return;
          if (storedItems.length) {
            setHistory(storedItems);
          }
          setHistoryLoaded(true);
        })
        .catch(() => {
          if (!cancelled) {
            setHistoryLoaded(true);
          }
        });
    } catch {
      setHistoryLoaded(true);
    } finally {
      setHydrated(true);
    }

    return () => {
      cancelled = true;
    };
  }, [isPublicMode]);

  useEffect(() => {
    if (!hydrated) return;
    saveSettingsSnapshot();
  }, [
    apiKey,
    baseUrl,
    hydrated,
    imageSize,
    isPublicMode,
    locale,
    model,
    theme,
    themePreferenceSet,
  ]);

  useEffect(() => {
    return () => {
      if (connectionSavedTimerRef.current) {
        window.clearTimeout(connectionSavedTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const trimmedApiKey = apiKey.trim();
    const trimmedBaseUrl = isPublicMode ? baseUrl.trim() : config.defaultBaseUrl;
    if (trimmedApiKey.length < 8 || (isPublicMode && !trimmedBaseUrl)) {
      setAvailableModels(fallbackModelOptions);
      setModelFetchStatus("idle");
      setModelFetchError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setModelFetchStatus("loading");
      setModelFetchError("");

      try {
        const response = await fetch("/api/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            apiKey: trimmedApiKey,
            baseUrl: isPublicMode ? trimmedBaseUrl : undefined,
          }),
        });

        const payload = (await response.json()) as ModelsResponse;
        if (!response.ok || "error" in payload) {
          const message =
            "error" in payload
              ? payload.error.code ?? payload.error.message ?? "unknown"
              : "unknown";
          throw new Error(message);
        }

        if (!payload.models.length) {
          setAvailableModels(fallbackModelOptions);
          setModelFetchStatus("empty");
          return;
        }

        const nextModels = payload.models.map((item) => ({
          id: item.id,
          displayName: item.displayName,
          description: item.description,
        }));
        setAvailableModels(nextModels);
        setModelFetchStatus("success");
        setModel((current) =>
          nextModels.some((item) => item.id === current) ? current : nextModels[0].id,
        );
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setAvailableModels(fallbackModelOptions);
        setModelFetchStatus("error");
        setModelFetchError(caught instanceof Error ? caught.message : "unknown");
      }
    }, 600);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [apiKey, baseUrl, config.defaultBaseUrl, hydrated, isPublicMode]);

  useEffect(() => {
    if (!hydrated || !historyLoaded) return;

    const nextHistory = history.slice(0, 20);
    const saveFallback = () => {
      try {
        localStorage.setItem(historyKey, JSON.stringify(nextHistory));
      } catch {
        // Browser storage can be full when history contains data URLs. Keep the UI usable.
      }
    };

    void saveHistoryToIndexedDb(nextHistory)
      .then((saved) => {
        if (!saved) saveFallback();
      })
      .catch(saveFallback);
  }, [history, historyLoaded, hydrated]);

  useEffect(() => {
    if (status !== "running") return;

    const startedAt = generationStartedAtRef.current ?? Date.now();
    generationStartedAtRef.current = startedAt;

    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    };

    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (!previewImage) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewImage(null);
      }
      if (previewImage.kind === "result" && event.key === "ArrowLeft") {
        event.preventDefault();
        selectResultByOffset(-1, true);
      }
      if (previewImage.kind === "result" && event.key === "ArrowRight") {
        event.preventDefault();
        selectResultByOffset(1, true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewImage, results, selectedResultIndex]);

  function updateLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    document.documentElement.lang = nextLocale;
  }

  function toggleTheme() {
    setThemePreferenceSet(true);
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  function showError(message: string) {
    setStatus("error");
    setError(message);
  }

  async function addReferenceFiles(files: File[]) {
    if (!files.length) return;

    const availableSlots = maxReferenceImages - references.length;
    if (availableSlots <= 0) {
      showError(t("error.fileCount"));
      return;
    }

    const selectedFiles = files.slice(0, availableSlots);
    if (files.length > availableSlots) {
      showError(t("error.fileCount"));
    } else {
      setError("");
      if (status === "error") setStatus("idle");
    }

    const validFiles: File[] = [];
    for (const file of selectedFiles) {
      if (!acceptedImageTypes.has(file.type)) {
        showError(t("error.fileType"));
        continue;
      }
      if (file.size > maxImageBytes) {
        showError(t("error.fileSize"));
        continue;
      }
      validFiles.push(file);
    }

    if (!validFiles.length) return;

    try {
      const nextImages = await Promise.all(validFiles.map(readFileAsImage));
      setReferences((current) =>
        [...current, ...nextImages].slice(0, maxReferenceImages),
      );
    } catch {
      showError(t("error.fileType"));
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    await addReferenceFiles(files);
  }

  async function handlePromptPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const itemFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    const files = itemFiles.length
      ? itemFiles
      : Array.from(event.clipboardData.files).filter((file) =>
          file.type.startsWith("image/"),
        );

    if (!files.length) return;

    event.preventDefault();
    await addReferenceFiles(files);
  }

  function clearReferences() {
    setReferences([]);
  }

  function removeReference(id: string) {
    setReferences((current) => current.filter((reference) => reference.id !== id));
  }

  function changeOutputCount(delta: number) {
    setOutputCount((current) => Math.min(4, Math.max(1, current + delta)));
  }

  function getApiErrorMessage(payload: GenerateResponse) {
    if (!("error" in payload)) return t("apiError.unknown");

    const code = payload.error.code ?? "unknown";
    const key = `apiError.${code}`;
    if (isI18nKey(key)) return t(key);

    return payload.error.message || t("apiError.unknown");
  }

  async function handleGenerate() {
    const trimmedPrompt = prompt.trim();
    const requestReferences = references;
    const operationKind: ImageKind = requestReferences.length ? "edit" : "generate";
    const sourceImageIds = requestReferences
      .map((reference) => reference.sourceImageId)
      .filter((id): id is string => Boolean(id));
    if (!apiKey.trim()) {
      showError(t("error.auth"));
      return;
    }
    if (!trimmedPrompt) {
      showError(t("prompt.placeholder"));
      return;
    }

    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;
    generationStartedAtRef.current = Date.now();
    setElapsedSeconds(0);
    setActiveOperation(operationKind);
    setStatus("running");
    setError("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          prompt: trimmedPrompt,
          apiKey,
          baseUrl: isPublicMode ? baseUrl : undefined,
          model,
          aspectRatio,
          imageSize,
          outputCount,
          images: requestReferences.map(({ name, mimeType, data }) => ({
            name,
            mimeType,
            data,
          })),
        }),
      });

      const payload = (await response.json()) as GenerateResponse;
      if (!response.ok || "error" in payload) {
        throw new Error(getApiErrorMessage(payload));
      }

      if (!payload.images.length) {
        throw new Error(t("apiError.no_image"));
      }

      const nextImages = payload.images.map((image) => ({
        ...image,
        kind: operationKind,
      }));
      const historyImages = nextImages.map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl,
        mimeType: image.mimeType,
        prompt: image.prompt,
        model: image.model,
        createdAt: image.createdAt,
        kind: operationKind,
      }));
      const nextSubtitle = new Date(nextImages[0].createdAt).toLocaleTimeString();

      setResults(nextImages);
      setSelectedResultId(nextImages[0]?.id ?? null);
      setHistory((current) => {
        const sourceIndex =
          operationKind === "edit"
            ? current.findIndex((item) =>
                getHistoryImages(item).some((image) =>
                  sourceImageIds.includes(image.id),
                ),
              )
            : -1;

        if (sourceIndex >= 0) {
          const sourceItem = current[sourceIndex];
          const mergedImages = [...getHistoryImages(sourceItem), ...historyImages];
          const cappedImages =
            mergedImages.length > 12
              ? [mergedImages[0], ...mergedImages.slice(-11)]
              : mergedImages;
          const updatedItem: HistoryItem = {
            ...sourceItem,
            subtitle: nextSubtitle,
            imageUrl: cappedImages[0].imageUrl,
            mimeType: cappedImages[0].mimeType,
            images: cappedImages,
          };

          return [
            updatedItem,
            ...current.filter((_, index) => index !== sourceIndex),
          ].slice(0, 20);
        }

        return [
          {
          id: makeId("history"),
          title: trimmedPrompt.slice(0, 28) || t("result.title"),
          subtitle: nextSubtitle,
          imageUrl: nextImages[0].imageUrl,
          prompt: trimmedPrompt,
          mimeType: nextImages[0].mimeType,
          model: model,
          createdAt: nextImages[0].createdAt,
          images: historyImages,
        },
          ...current,
        ].slice(0, 20);
      });
      setStatus("success");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        generationStartedAtRef.current = null;
        setStatus("idle");
        setError("");
        return;
      }
      setStatus("error");
      setError(caught instanceof Error ? caught.message : t("error.network"));
    } finally {
      if (abortRef.current === abortController) {
        abortRef.current = null;
      }
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    abortRef.current = null;
    generationStartedAtRef.current = null;
    setStatus("idle");
    setError("");
  }

  function downloadImage(image: {
    id: string;
    imageUrl?: string;
    mimeType?: string;
  }) {
    if (!image.imageUrl) return;
    const link = document.createElement("a");
    link.href = image.imageUrl;
    link.download = `gemini-image-${image.id}.${getFileExtension(
      image.mimeType ?? parseDataUrl(image.imageUrl)?.mimeType ?? "image/png",
    )}`;
    link.click();
  }

  function downloadHistoryItem(item: HistoryItem) {
    const images = getHistoryImages(item);
    for (const image of images) {
      downloadImage(image);
    }
  }

  function handleDownload() {
    if (!selectedResult) return;
    downloadImage(selectedResult);
  }

  function sendImageToEdit(image: {
    id: string;
    imageUrl: string;
    mimeType?: string;
  }) {
    const parsed = parseDataUrl(image.imageUrl);
    if (!parsed) return;

    setReferences((current) => [
      {
        id: makeId("result-ref"),
        name: `generated-${image.id}.${getFileExtension(
          image.mimeType ?? parsed.mimeType,
        )}`,
        mimeType: parsed.mimeType,
        dataUrl: image.imageUrl,
        data: parsed.data,
        sourceImageId: image.id,
      },
      ...current,
    ].slice(0, maxReferenceImages));
  }

  function sendSelectedToEdit() {
    if (!selectedResult) return;
    sendImageToEdit(selectedResult);
  }

  function openResultPreview(image: GeneratedImage) {
    setPreviewImage({
      id: image.id,
      kind: "result",
      src: image.imageUrl,
      alt: image.prompt,
      mimeType: image.mimeType,
    });
  }

  function selectResultByOffset(delta: number, updatePreview = false) {
    if (!results.length) return;

    const currentIndex = Math.max(
      0,
      selectedResultIndex >= 0 ? selectedResultIndex : 0,
    );
    const nextIndex = (currentIndex + delta + results.length) % results.length;
    const nextResult = results[nextIndex];
    setSelectedResultId(nextResult.id);
    if (updatePreview) {
      openResultPreview(nextResult);
    }
  }

  function removeResultFromHistory(imageId: string) {
    setHistory((current) =>
      current
        .map((item) => {
          const images = getHistoryImages(item);
          if (!images.some((image) => image.id === imageId)) return item;

          const nextImages = images.filter((image) => image.id !== imageId);
          if (!nextImages.length) return null;

          return {
            ...item,
            imageUrl: nextImages[0].imageUrl,
            mimeType: nextImages[0].mimeType,
            images: nextImages,
          };
        })
        .filter((item): item is HistoryItem => Boolean(item)),
    );
  }

  function removeResult(imageId: string) {
    const removedIndex = results.findIndex((result) => result.id === imageId);
    if (removedIndex < 0) return;

    const nextResults = results.filter((result) => result.id !== imageId);
    setResults(nextResults);
    setSelectedResultId((currentSelectedId) => {
      if (!nextResults.length) return null;
      if (
        currentSelectedId &&
        currentSelectedId !== imageId &&
        nextResults.some((result) => result.id === currentSelectedId)
      ) {
        return currentSelectedId;
      }

      return nextResults[Math.min(removedIndex, nextResults.length - 1)].id;
    });
    removeResultFromHistory(imageId);
    setPreviewImage((current) =>
      current?.kind === "result" && current.id === imageId ? null : current,
    );
  }

  function removeHistoryItem(itemId: string) {
    setHistory((current) => current.filter((item) => item.id !== itemId));
  }

  function downloadPreviewImage() {
    if (!previewImage) return;
    downloadImage({
      id: previewImage.id ?? "preview",
      imageUrl: previewImage.src,
      mimeType: previewImage.mimeType,
    });
  }

  function sendPreviewToEdit() {
    if (previewImage?.kind !== "result" || !previewImage.id) return;

    const previewResult = results.find((result) => result.id === previewImage.id);
    if (previewResult) {
      sendImageToEdit(previewResult);
    }
  }

  function deletePreviewResult() {
    if (previewImage?.kind !== "result" || !previewImage.id) return;
    removeResult(previewImage.id);
  }

  function applyPreset(preset: PresetOption) {
    setSelectedPreset(preset.id);
    setPrompt(t(preset.promptKey));
  }

  function updatePrompt(value: string) {
    setSelectedPreset(null);
    setPrompt(value);
  }

  function selectHistoryItem(item: HistoryItem) {
    const restoredImages = getHistoryImages(item).map((image) =>
      historyImageToGeneratedImage(image, item, model),
    );
    if (!restoredImages.length) return;

    setResults(restoredImages.slice(0, 8));
    setSelectedResultId(restoredImages[0].id);
  }

  function getModelStatusText() {
    if (modelFetchStatus === "loading") return t("model.loading");
    if (modelFetchStatus === "success") {
      return `${t("model.loaded")} (${availableModels.length})`;
    }
    if (modelFetchStatus === "empty") return t("model.empty");
    if (modelFetchStatus === "error") {
      const key = `apiError.${modelFetchError}` as I18nKey;
      return isI18nKey(key)
        ? `${t("model.error")}：${t(key)}`
        : t("model.error");
    }

    return t("model.fetchHint");
  }

  const elapsedText = `${t("state.elapsed")} ${elapsedSeconds}s`;
  const operationRunningText =
    activeOperation === "edit" ? t("state.editing") : t("state.running");
  const operationDetailText =
    activeOperation === "edit"
      ? t("state.editingDetail")
      : t("state.generatingDetail");

  const statusMessage =
    status === "running"
      ? `${operationRunningText} · ${elapsedText}`
      : status === "error"
        ? translatedError
        : t("state.idle");
  const showSelectedPreview = Boolean(selectedResult) && status !== "running";
  const hasResultTray = results.length > 1;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <div className="brand-title">{t("app.name")}</div>
        </div>
        <div className="top-actions">
          <div className="status-pill">
            <span className="status-dot" aria-hidden="true" />
            <span>{t("status.connected")}</span>
          </div>
          <button
            className="icon-button"
            type="button"
            title={t(theme === "dark" ? "theme.light" : "theme.dark")}
            aria-label={t(theme === "dark" ? "theme.light" : "theme.dark")}
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <div className="lang-switch" aria-label={t("language.label")}>
            <button
              className={`lang-option ${locale === "zh-CN" ? "active" : ""}`}
              type="button"
              onClick={() => updateLocale("zh-CN")}
            >
              {t("language.zh")}
            </button>
            <button
              className={`lang-option ${locale === "en-US" ? "active" : ""}`}
              type="button"
              onClick={() => updateLocale("en-US")}
            >
              {t("language.en")}
            </button>
          </div>
        </div>
      </header>

      <main className={`workbench mobile-${mobileView}`}>
        <div className="mobile-tabs" aria-label={t("nav.mobile")}>
          {(
            [
              ["compose", "prompt.label"],
              ["setup", "nav.connection"],
              ["output", "settings.output"],
              ["history", "history.title"],
            ] as const
          ).map(([view, labelKey]) => (
            <button
              className={`seg-button ${mobileView === view ? "active" : ""}`}
              key={view}
              type="button"
              aria-pressed={mobileView === view}
              onClick={() => setMobileView(view)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        <aside className="panel config-panel">
          <div className="panel-scroll">
            <section className="section mode-note">
              <h2 className="section-title">{t("mode.title")}</h2>
              <div className="mode-current">
                <span className="status-dot" aria-hidden="true" />
                <span>{t(isPublicMode ? "mode.public" : "mode.managed")}</span>
              </div>
              <p className="hint mode-help">
                {t(isPublicMode ? "mode.help.public" : "mode.help.managed")}
              </p>
            </section>

            <section className="section connection-section">
              <h2 className="section-title">{t("nav.connection")}</h2>
              <div className="field">
                <label htmlFor="api-key">{t("field.apiKey")}</label>
                <input
                  id="api-key"
                  className="control"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="AIza..."
                />
              </div>
              {isPublicMode ? (
                <div className="field base-url-field">
                  <label htmlFor="base-url">{t("field.baseUrl")}</label>
                  <input
                    id="base-url"
                    className="control"
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                  />
                </div>
              ) : null}
              <div className="connection-actions">
                <button
                  className="tool-button primary"
                  type="button"
                  onClick={handleSaveConnection}
                >
                  <Save size={15} />
                  {t("action.save")}
                </button>
                <button
                  className="tool-button subtle"
                  type="button"
                  onClick={() => {
                    setApiKey("");
                    setConnectionSaved(false);
                  }}
                >
                  <Trash2 size={15} />
                  {t("action.clear")}
                </button>
              </div>
              <div
                className={`connection-save-status ${
                  connectionSaved ? "visible" : ""
                }`}
                aria-live="polite"
              >
                {connectionSaved ? (
                  <>
                    <Check size={13} />
                    <span>{t("settings.saved")}</span>
                  </>
                ) : null}
              </div>
            </section>

            <section className="section model-section">
              <h2 className="section-title">{t("nav.model")}</h2>
              <div className="field">
                <label htmlFor="model-select">{t("field.model")}</label>
                <select
                  id="model-select"
                  className="control"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                >
                  {modelSelectOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName ? `${item.displayName} (${item.id})` : item.id}
                    </option>
                  ))}
                </select>
              </div>
              <p
                className={`hint model-status ${
                  modelFetchStatus === "error" ? "error" : ""
                }`}
              >
                {getModelStatusText()}
              </p>
              <div className="capability-list" aria-label={t("cap.title")}>
                <span className="capability-label">{t("cap.title")}</span>
                <span className="capability-item">{t("cap.textToImage")}</span>
                <span className="capability-item">{t("cap.references")}</span>
                <span className="capability-item">{t("cap.multiImage")}</span>
              </div>
            </section>

            <section className="section preset-section">
              <div className="preset-head">
                <h2 className="section-title">{t("nav.presets")}</h2>
                <a
                  className="preset-inspiration"
                  href={inspirationUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={t("preset.inspiration")}
                >
                  <span>{t("preset.inspiration")}</span>
                  <ExternalLink size={13} />
                </a>
              </div>
              <div className="preset-list">
                {presetOptions.map((preset) => (
                  <button
                    className={`preset-item ${
                      selectedPreset === preset.id ? "active" : ""
                    }`}
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                  >
                    <span className="preset-main">
                      <span>{t(preset.labelKey)}</span>
                      <span
                        className={`preset-mode ${preset.mode}`}
                        title={t(
                          preset.mode === "reference"
                            ? "preset.mode.reference"
                            : "preset.mode.text",
                        )}
                      >
                        {t(
                          preset.mode === "reference"
                            ? "preset.mode.reference"
                            : "preset.mode.text",
                        )}
                      </span>
                    </span>
                    {preset.referenceKey ? (
                      <span className="preset-reference">{t(preset.referenceKey)}</span>
                    ) : null}
                    <span className="preset-code">{preset.code}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </aside>

        <section className="panel stage-panel">
          <div className="stage">
            <div className="editor-shell">
              <div className="editor-head">
                <h2 className="section-title">{t("prompt.label")}</h2>
                <div className="mini-tools">
                  <button
                    className="icon-button"
                    type="button"
                    title={t("action.template")}
                    aria-label={t("action.template")}
                    onClick={() => applyPreset(presetOptions[0])}
                  >
                    <Clipboard size={15} />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={t("action.clear")}
                    aria-label={t("action.clear")}
                    onClick={() => updatePrompt("")}
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={t("action.paste")}
                    aria-label={t("action.paste")}
                    onClick={async () => {
                      const text = await navigator.clipboard?.readText().catch(() => "");
                      if (text) updatePrompt(text);
                    }}
                  >
                    <Clipboard size={15} />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title={t("references.upload")}
                    aria-label={t("references.upload")}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={15} />
                  </button>
                </div>
              </div>
              <div className="mobile-prompt-tools">
                <div className="mobile-model-row">
                  <label>{t("field.model")}</label>
                  <select
                    className="control"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    aria-label={t("field.model")}
                  >
                    {modelSelectOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.displayName
                          ? `${item.displayName} (${item.id})`
                          : item.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mobile-model-row">
                  <label>{t("nav.presets")}</label>
                  <select
                    className="control"
                    value={selectedPreset ?? ""}
                    onChange={(event) => {
                      const preset = presetOptions.find(
                        (item) => item.id === event.target.value,
                      );
                      if (preset) applyPreset(preset);
                    }}
                    aria-label={t("nav.presets")}
                  >
                    <option value="">{t("nav.presets")}</option>
                    {presetOptions.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {t(preset.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <textarea
                className="textarea"
                placeholder={t("prompt.placeholder")}
                value={prompt}
                onChange={(event) => updatePrompt(event.target.value)}
                onPaste={handlePromptPaste}
              />
              <input
                ref={fileInputRef}
                className="file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={handleFileChange}
              />
              <div className="attachment-strip" aria-label={t("references.label")}>
                <button
                  className="attachment-add"
                  type="button"
                  title={t("references.upload")}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={14} />
                  <span>{t("references.label")}</span>
                </button>
                {references.map((reference) => (
                  <div className="attachment-thumb" key={reference.id}>
                    <button
                      className="attachment-preview"
                      type="button"
                      title={t("action.zoom")}
                      aria-label={t("action.zoom")}
                      onClick={() =>
                        setPreviewImage({
                          id: reference.id,
                          kind: "reference",
                          src: reference.dataUrl,
                          alt: reference.name,
                          mimeType: reference.mimeType,
                        })
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt={reference.name} src={reference.dataUrl} />
                    </button>
                    <button
                      className="attachment-remove"
                      type="button"
                      title={t("action.clear")}
                      aria-label={t("action.clear")}
                      onClick={() => removeReference(reference.id)}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                {references.length ? (
                  <button
                    className="icon-button compact"
                    type="button"
                    title={t("action.clearReferences")}
                    aria-label={t("action.clearReferences")}
                    onClick={clearReferences}
                  >
                    <Trash2 size={13} />
                  </button>
                ) : null}
                <span className="hint attachment-limit">{t("references.limit")}</span>
              </div>
              <div className="prompt-footer">
                <span className="hint">
                  {prompt.length}
                  {t("unit.characters")}
                </span>
                <span className="hint model-hint">{model}</span>
              </div>
            </div>

            <div className="result-canvas">
              <div className="canvas-head">
                <h2 className="section-title">{t("result.title")}</h2>
                <span
                  className={`hint status-message ${
                    status === "error" ? "error" : status === "running" ? "running" : ""
                  }`}
                  title={statusMessage}
                >
                  {statusMessage}
                </span>
              </div>
              <div
                className={`canvas-body ${
                  hasResultTray ? "has-result-tray" : "solo-preview"
                }`}
              >
                <div className="main-preview-wrap">
                  <button
                    className={`main-preview ${showSelectedPreview ? "can-zoom" : "empty-preview"}`}
                    type="button"
                    aria-label={
                      showSelectedPreview ? t("action.zoom") : t("state.emptyResult")
                    }
                    onClick={() => {
                      if (showSelectedPreview && selectedResult) {
                        openResultPreview(selectedResult);
                      }
                    }}
                    disabled={!showSelectedPreview}
                  >
                    {showSelectedPreview && selectedResult ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={selectedResult.prompt} src={selectedResult.imageUrl} />
                        <span
                          className={`image-kind-badge ${normalizeImageKind(
                            selectedResult.kind,
                          )}`}
                        >
                          {getImageKindLabel(selectedResult.kind)}
                        </span>
                      </>
                    ) : status !== "running" ? (
                      <div className="empty-copy">{t("state.emptyResult")}</div>
                    ) : null}
                    {status === "running" ? (
                      <div className="generation-overlay" aria-live="polite">
                        <div className="generation-spinner" aria-hidden="true" />
                        <div className="generation-title">{operationDetailText}</div>
                        <div className="generation-time">{elapsedText}</div>
                      </div>
                    ) : showSelectedPreview ? (
                      <span className="zoom-affordance" aria-hidden="true">
                        <Maximize2 size={15} />
                      </span>
                    ) : null}
                  </button>
                  {results.length > 1 && status !== "running" ? (
                    <>
                      <button
                        className="preview-nav previous"
                        type="button"
                        title={t("action.previous")}
                        aria-label={t("action.previous")}
                        onClick={() => selectResultByOffset(-1)}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        className="preview-nav next"
                        type="button"
                        title={t("action.next")}
                        aria-label={t("action.next")}
                        onClick={() => selectResultByOffset(1)}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </>
                  ) : null}
                </div>
                {hasResultTray ? (
                  <div className="result-side">
                    {results.slice(0, 4).map((result) => (
                      <div
                        className={`image-tile-wrap ${
                          result && result.id === selectedResult?.id ? "selected" : ""
                        }`}
                        key={result.id}
                      >
                        <button
                          className={`image-tile ${
                            result && result.id === selectedResult?.id ? "selected" : ""
                          }`}
                          type="button"
                          onClick={() => setSelectedResultId(result.id)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt={result.prompt} src={result.imageUrl} />
                          <span
                            className={`image-kind-badge ${normalizeImageKind(
                              result.kind,
                            )}`}
                          >
                            {getImageKindLabel(result.kind)}
                          </span>
                        </button>
                        <button
                          className="tile-remove"
                          type="button"
                          title={t("action.deleteCurrent")}
                          aria-label={t("action.deleteCurrent")}
                          onClick={() => removeResult(result.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {status === "running" || status === "error" ? (
                      <div className="state-strip">
                        <div
                          className={`state-card ${
                            status === "running" ? "running" : "error"
                          }`}
                        >
                          {status === "running" ? elapsedText : translatedError}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="action-bar">
              <div className="actions-left">
                <button
                  className="tool-button"
                  type="button"
                  onClick={handleGenerate}
                  disabled={status === "running"}
                >
                  <RotateCcw size={15} />
                  {t("action.retry")}
                </button>
                <button
                  className="tool-button danger"
                  type="button"
                  onClick={handleStop}
                  disabled={status !== "running"}
                >
                  <Square size={14} />
                  {t("action.stop")}
                </button>
              </div>
              <div className="actions-right">
                <button
                  className="tool-button"
                  type="button"
                  onClick={handleDownload}
                  disabled={!selectedResult}
                >
                  <Download size={15} />
                  {t("action.download")}
                </button>
                <button
                  className="tool-button primary"
                  type="button"
                  onClick={handleGenerate}
                  disabled={status === "running"}
                >
                  <ImagePlus size={16} />
                  {references.length ? t("action.editImage") : t("action.generate")}
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="panel params-panel">
          <div className="panel-scroll">
            <section className="section">
              <h2 className="section-title">{t("settings.output")}</h2>
              <p className="hint output-note">{t("settings.modelDefaultHint")}</p>
              <div className="field">
                <label>{t("settings.aspectRatio")}</label>
                <div className="segmented ratio-options">
                  {[
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
                  ].map((ratio) => (
                    <button
                      className={`seg-button ${ratio === aspectRatio ? "active" : ""}`}
                      key={ratio}
                      type="button"
                      onClick={() => setAspectRatio(ratio)}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>{t("settings.imageSize")}</label>
                <div className="segmented compact-options">
                  {["1K", "2K", "4K"].map((size) => (
                    <button
                      className={`seg-button ${size === imageSize ? "active" : ""}`}
                      key={size}
                      type="button"
                      onClick={() => setImageSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <p className="hint setting-hint">{t("settings.imageSizeHint")}</p>
              </div>
              <div className="field">
                <label>{t("settings.count")}</label>
                <div className="stepper">
                  <button type="button" onClick={() => changeOutputCount(-1)}>
                    -
                  </button>
                  <span>{outputCount}</span>
                  <button type="button" onClick={() => changeOutputCount(1)}>
                    +
                  </button>
                </div>
              </div>
            </section>

            <section className="section current-image">
              <h2 className="section-title">{t("current.title")}</h2>
              <div className={`current-preview ${selectedResult ? "" : "empty-current"}`}>
                {selectedResult ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={selectedResult.prompt} src={selectedResult.imageUrl} />
                    <span
                      className={`image-kind-badge ${normalizeImageKind(
                        selectedResult.kind,
                      )}`}
                    >
                      {getImageKindLabel(selectedResult.kind)}
                    </span>
                  </>
                ) : (
                  <span>{t("current.empty")}</span>
                )}
              </div>
              <div className="chip-list current-actions">
                <button
                  className="tool-button"
                  type="button"
                  onClick={handleDownload}
                  disabled={!selectedResult}
                >
                  <Download size={15} />
                  {t("action.download")}
                </button>
                <button
                  className="tool-button primary"
                  type="button"
                  onClick={sendSelectedToEdit}
                  disabled={!selectedResult}
                >
                  <Send size={15} />
                  {t("action.sendToEdit")}
                </button>
                <button
                  className="tool-button danger"
                  type="button"
                  onClick={() => selectedResult && removeResult(selectedResult.id)}
                  disabled={!selectedResult}
                  title={t("action.deleteCurrent")}
                  aria-label={t("action.deleteCurrent")}
                >
                  <Trash2 size={15} />
                  {t("action.deleteCurrent")}
                </button>
              </div>
            </section>

            <section className="history">
              <div className="history-head">
                <h2 className="section-title">{t("history.title")}</h2>
                <button
                  className="icon-button"
                  type="button"
                  title={t("action.search")}
                  aria-label={t("action.search")}
                  onClick={() => setHistorySearchOpen((current) => !current)}
                >
                  <Search size={15} />
                </button>
              </div>
              {historySearchOpen || historyQuery ? (
                <div className="history-search">
                  <Search size={14} aria-hidden="true" />
                  <input
                    className="history-search-input"
                    value={historyQuery}
                    onChange={(event) => setHistoryQuery(event.target.value)}
                    placeholder={t("history.searchPlaceholder")}
                  />
                  {historyQuery ? (
                    <button
                      className="history-search-clear"
                      type="button"
                      title={t("action.clear")}
                      aria-label={t("action.clear")}
                      onClick={() => setHistoryQuery("")}
                    >
                      <X size={13} />
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="history-list">
                {filteredHistory.length ? (
                  filteredHistory.map((item) => {
                    const images = getHistoryImages(item);
                    const editCount = images.filter(
                      (image) => normalizeImageKind(image.kind) === "edit",
                    ).length;
                    const fullPrompt = item.prompt ?? item.title;
                    const isActive = images.some(
                      (image) => image.id === selectedResult?.id,
                    );

                    return (
                      <div
                        className={`history-row ${isActive ? "active" : ""}`}
                        key={item.id}
                        title={fullPrompt}
                      >
                        <button
                          className="history-main"
                          type="button"
                          title={fullPrompt}
                          onClick={() => selectHistoryItem(item)}
                        >
                          <div
                            className={`history-thumb history-thumb-count-${Math.min(
                              images.length || 1,
                              4,
                            )}`}
                          >
                            {images.slice(0, 4).map((image) => (
                              <span className="history-thumb-item" key={image.id}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  alt={image.prompt ?? item.title}
                                  src={image.imageUrl}
                                />
                                <span
                                  className={`image-kind-dot ${normalizeImageKind(
                                    image.kind,
                                  )}`}
                                  title={getImageKindLabel(image.kind)}
                                  aria-label={getImageKindLabel(image.kind)}
                                />
                              </span>
                            ))}
                            {images.length > 1 ? (
                              <span className="history-count">{images.length}</span>
                            ) : null}
                          </div>
                          <div className="history-meta">
                            <p className="history-title">
                              {isI18nKey(item.title) ? dictionary[item.title] : item.title}
                            </p>
                            <p className="history-sub">
                              {[
                                item.subtitle,
                                images.length > 1
                                  ? `${images.length}${t("unit.images")}`
                                  : "",
                                editCount
                                  ? `${editCount}${t("unit.edits")}`
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                        </button>
                        <div className="history-actions">
                          <button
                            className="history-icon"
                            type="button"
                            title={t("action.download")}
                            aria-label={t("action.download")}
                            onClick={() => downloadHistoryItem(item)}
                            disabled={!images.length}
                          >
                            <Download size={14} />
                          </button>
                          <button
                            className="history-icon danger"
                            type="button"
                            title={t("history.deleteRecord")}
                            aria-label={t("history.deleteRecord")}
                            onClick={() => removeHistoryItem(item.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="history-empty">
                    <p>{history.length ? t("history.noMatches") : t("history.empty")}</p>
                    <span>
                      {history.length
                        ? t("history.searchHint")
                        : t("history.emptyHint")}
                    </span>
                  </div>
                )}
              </div>
            </section>
          </div>
        </aside>
      </main>

      {previewImage ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={t("preview.title")}
          onClick={() => setPreviewImage(null)}
        >
          <div className="lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <div className="lightbox-head">
              <div className="lightbox-title" title={previewImage.alt}>
                {previewImage.alt || t("preview.title")}
              </div>
              <div className="lightbox-actions">
                {previewImage.kind === "result" && results.length > 1 ? (
                  <>
                    <button
                      className="icon-button"
                      type="button"
                      title={t("action.previous")}
                      aria-label={t("action.previous")}
                      onClick={() => selectResultByOffset(-1, true)}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      title={t("action.next")}
                      aria-label={t("action.next")}
                      onClick={() => selectResultByOffset(1, true)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                ) : null}
                <button
                  className="icon-button"
                  type="button"
                  title={t("action.download")}
                  aria-label={t("action.download")}
                  onClick={downloadPreviewImage}
                >
                  <Download size={16} />
                </button>
                {previewImage.kind === "result" ? (
                  <>
                    <button
                      className="icon-button"
                      type="button"
                      title={t("action.sendToEdit")}
                      aria-label={t("action.sendToEdit")}
                      onClick={sendPreviewToEdit}
                    >
                      <Send size={16} />
                    </button>
                    <button
                      className="icon-button danger"
                      type="button"
                      title={t("action.deleteCurrent")}
                      aria-label={t("action.deleteCurrent")}
                      onClick={deletePreviewResult}
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                ) : null}
                <button
                  className="icon-button"
                  type="button"
                  title={t("action.close")}
                  aria-label={t("action.close")}
                  onClick={() => setPreviewImage(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="lightbox-body">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={previewImage.alt} src={previewImage.src} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
