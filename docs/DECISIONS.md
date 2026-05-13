# Decisions

## 2026-05-12 - Product Shape

决定做 Gemini 专用图像工作台，名称暂定为 Gemini Image Desk。

原因：

- 用户想要类似 `img.1415.xin` 的高效 API 工作台。
- 现有 Gemini 开源项目多数偏编辑器、ComfyUI 节点或产品展示页。
- 专用工作台能更好服务 Gemini 图像生成、参考图编辑和历史复用。

## 2026-05-12 - UI Direction

决定使用三栏工作台布局，而不是复制目标站的上下表单布局。

原因：

- 左配置、中创作、右参数/历史更接近专业工具。
- 更容易承载多图参考、历史复用和继续编辑。
- 能明显形成自己的视觉和交互风格。

## 2026-05-12 - First Version Scope

第一版只做本地/自托管单用户工作流。

包括：

- API Key 和 Base URL 配置
- 文生图
- 参考图编辑
- 多图输入
- 历史记录
- 下载和继续编辑

暂不包括：

- 账号系统
- 云端图库
- 支付
- 分享社区
- 节点工作流

## 2026-05-12 - Technical Direction

默认使用 Next.js + React + TypeScript。

原因：

- 适合快速构建工作台 UI。
- 可以用 API route/proxy 隔离浏览器和 Gemini 请求细节。
- 后续扩展自托管、环境变量 Key、服务端存储比较顺。

## 2026-05-12 - Figma-First UI Step

决定在正式实现前先做 Figma 设计稿。

原因：

- 用户希望先看 UI 设计，而不是直接进入代码实现。
- 三栏工作台的信息密度较高，先做设计能提前发现布局和响应式问题。
- Figma 稿能成为后续前端实现的验收基准。

当前限制：

- 已安装 `figma-generate-design` 和 `figma-use` skills。
- 已通过 Codex 全局配置连接 Figma MCP server。
- 目标 Figma 文件已提供：`K1HpTu04xhPavNaYcH0f4w`。
- 当前 Figma MCP Starter plan 已达到工具调用次数限制，设计稿写入暂时阻塞。

## 2026-05-12 - i18n

决定第一版支持中文和英文。

默认语言：

- `zh-CN`

第二语言：

- `en-US`

原因：

- 用户主要使用中文，需要中文作为默认体验。
- 英文作为第二语言能方便后续开源、演示和国际化扩展。
- 设计阶段先考虑英文长度，可以减少后续 UI 溢出和返工。

## 2026-05-12 - Local Prototype Fallback

决定在 Figma MCP 配额恢复前，先创建本地 HTML 高保真原型。

原因：

- Figma MCP Starter plan 已达到工具调用次数限制，无法继续写入设计稿。
- 本地原型可以直接验证三栏布局、响应式和中英文文案长度。
- 后续可以把本地原型迁移回 Figma，或直接作为前端实现参考。

产物：

- `prototype/index.html`
- `prototype/README.md`

## 2026-05-12 - Technical Architecture

决定使用 Next.js App Router + TypeScript 构建正式前端项目。

原因：

- 同一个项目可以同时承载工作台 UI 和服务端 API route。
- Gemini API 调用可以放在服务端 provider adapter，避免组件直接接触模型请求细节。
- Next.js standalone output 适合后续 Docker 自托管部署。

部署方向：

- multi-stage Dockerfile
- `docker-compose.yml`
- 支持公开模式和托管 Base URL 模式

## 2026-05-12 - Base URL Modes

决定第一版只支持两种 Base URL 模式。

公开模式：

- UI 显示 API Key 和 Base URL
- 用户可以填写 Gemini 官方地址或兼容代理地址

托管 Base URL 模式：

- UI 只显示 API Key
- Base URL 从服务端 `GEMINI_BASE_URL` 读取
- 客户端传入的 Base URL 会被忽略

原因：

- 用户只需要这两种真实部署形态。
- 逻辑清楚，避免把服务器 Key 模式、代理模式、个人模式拆得过碎。
- Docker 部署时只需要通过 `PUBLIC_BASE_URL_CONFIG` 控制 UI 和服务端行为。
