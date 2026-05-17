# NewAPI Compatibility

Gemini Image Desk can be opened from a NewAPI chat preset link and prefill the
connection fields from the URL. The app still sends generation requests through
`/api/generate`, and the provider adapter keeps the Gemini request format in
`lib/providers/`.

## Recommended NewAPI Chat Preset

When Gemini Image Desk is deployed in public Base URL mode:

```json
[
  {
    "Gemini Image Desk": "https://your-desk.example.com/?key={key}&address={address}&model=gemini-2.5-flash-image"
  }
]
```

NewAPI replaces:

- `{key}` with `sk-xxxx`
- `{address}` with the NewAPI server address without a trailing `/v1`

Gemini Image Desk accepts either a NewAPI root address, such as
`https://new-api.example.com`, or a versioned address, such as
`https://new-api.example.com/v1`.

For managed Base URL mode, set the deployment environment instead:

```env
PUBLIC_BASE_URL_CONFIG=false
GEMINI_BASE_URL=https://new-api.example.com
GEMINI_DEFAULT_MODEL=gemini-2.5-flash-image
```

Then the preset only needs the key:

```json
[
  {
    "Gemini Image Desk": "https://your-desk.example.com/?key={key}&model=gemini-2.5-flash-image"
  }
]
```

## Supported Prefill Inputs

The workbench reads these URL parameters from either `?query` or `#/?query`:

- API key: `apiKey`, `api_key`, `key`, `token`
- Base URL: `baseUrl`, `baseURL`, `base_url`, `url`, `address`, `server`
- Other fields: `model`, `modelId`, `model_id`, `prompt`, `imageSize`, `locale`, `lang`

It also understands common NewAPI-style chat payloads:

- `settings={...}` JSON, including NextChat and Lobe Chat-like shapes
- `provider={...}` JSON, including AI as Workspace-like shapes
- `data=...` base64 JSON, including Cherry Studio, AionUI, and DeepChat-like shapes

If an API key is found in the URL, the app immediately removes the query and hash
from the browser address bar with `history.replaceState` so the key does not stay
visible in the URL.

## NewAPI Endpoint Notes

NewAPI exposes Gemini-compatible relay routes such as:

```text
/v1beta/models/{model}:generateContent
/v1/models/{model}:generateContent
```

That matches the current Gemini provider adapter, so no OpenAI chat-completions
adapter is required for the image workbench path.
