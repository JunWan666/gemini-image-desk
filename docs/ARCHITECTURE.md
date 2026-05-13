# Architecture

## Stack

- Framework: Next.js App Router
- Language: TypeScript
- UI: React components + CSS variables
- Icons: lucide-react
- i18n: local dictionary first, default `zh-CN`, secondary `en-US`
- State: React state for local UI, small stores only when state crosses panels
- Storage: browser local storage / IndexedDB for settings and image history
- API: server-side provider adapters under `lib/providers/`
- Deployment: Docker image using Next.js standalone output

## Why This Stack

Next.js gives us a single deployable app with frontend UI and server routes. That is useful here because Gemini API keys should not be hardcoded into browser code, and future Docker deployment is straightforward.

The app should remain self-host friendly. It must not depend on Vercel-only features.

## Project Shape

```text
app/
  api/
    generate/route.ts
  page.tsx
components/
  workbench/
  ui/
lib/
  i18n/
  providers/
    gemini/
  storage/
  validation/
types/
```

## Runtime Modes

First version supports exactly two UI modes:

### Public Mode

Public Mode exposes both API Key and Base URL in the UI.

Use this when:

- the instance is meant for broad users
- users may bring their own Gemini-compatible proxy
- users need to test different Base URLs

### Managed Base URL Mode

Managed Base URL Mode hides Base URL from the UI. The server reads it from environment config, and the user only enters API Key.

Use this when:

- the deployer wants a cleaner UI
- the Base URL should be fixed for the whole instance
- users only need to bring their own API Key

Suggested environment variables:

```text
PUBLIC_BASE_URL_CONFIG=true
GEMINI_BASE_URL=https://generativelanguage.googleapis.com
```

`PUBLIC_BASE_URL_CONFIG=true` means Base URL is visible and editable.

`PUBLIC_BASE_URL_CONFIG=false` means Base URL is hidden and the server uses `GEMINI_BASE_URL`.

## Request Flow

1. User enters prompt and optional reference images.
2. UI sends a normalized request to `/api/generate`.
3. API route chooses a provider adapter.
4. Gemini adapter calls the configured Gemini-compatible endpoint.
5. API route normalizes result images and errors.
6. UI writes successful results into local history.

## Provider Rules

- React components must not directly call Gemini.
- API keys must not be logged.
- Provider-specific parameters stay inside adapter code.
- Model capabilities should live in config, not scattered through UI.
- Base URL is user-configurable only in Public Mode.
- In Managed Base URL Mode, Base URL must come from server configuration and must not be shown as an editable UI field.

## Local Data

First version stores these locally:

- API Base URL only when Public Mode is enabled
- selected model
- language
- prompt presets
- image generation history
- API key only if user explicitly enables local saving

If history grows large, move image blobs from localStorage to IndexedDB.

## Docker Direction

The Docker image should run the Next.js server in standalone mode. A `docker-compose.yml` should expose one app port and allow environment variable configuration for optional server-side defaults.
