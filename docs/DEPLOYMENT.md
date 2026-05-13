# Deployment

Gemini Image Desk 的第一版部署目标是自托管友好：一个 Next.js 应用，一个 Docker 镜像，不把 API Key 烧进镜像。

## Connection Modes

### 简洁模式

默认模式。界面隐藏 Base URL，服务端读取固定的 `GEMINI_BASE_URL`，用户只填写自己的 API Key。

```text
PUBLIC_BASE_URL_CONFIG=false
GEMINI_BASE_URL=https://generativelanguage.googleapis.com
```

### 自定义 Base URL

界面同时显示 API Key 和 Base URL，适合用户自带 Gemini 兼容代理。

```text
PUBLIC_BASE_URL_CONFIG=true
GEMINI_BASE_URL=https://generativelanguage.googleapis.com
```

## Environment Variables

```text
PORT=3000
GEMINI_BASE_URL=https://generativelanguage.googleapis.com
GEMINI_DEFAULT_MODEL=gemini-2.5-flash-image
PUBLIC_BASE_URL_CONFIG=false
```

当前版本不提供服务端共享 API Key 模式。API Key 由用户在浏览器填写，并通过本实例的 `/api/generate` 发送到 Gemini。

## Docker Compose

```bash
docker compose up --build
```

默认映射：

```text
http://localhost:3000
```

## Docker Image

项目使用 Next.js standalone 输出：

```bash
docker build -t gemini-image-desk:latest .
docker run --rm -p 3000:3000 \
  -e GEMINI_BASE_URL=https://generativelanguage.googleapis.com \
  -e PUBLIC_BASE_URL_CONFIG=false \
  gemini-image-desk:latest
```

## Production Notes

- 建议放在 Caddy、nginx、Traefik 等反向代理后面提供 HTTPS。
- 不要用 Docker build args 传 API Key。
- 如果公开部署，建议开启访问控制或限流，避免实例被滥用。
- 图片历史当前保存在浏览器本地，换浏览器或清理站点数据后会消失。
