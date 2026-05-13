# Task List

## Phase 0 - Direction

- [x] 明确产品方向：Gemini 专用图像生成工作台
- [x] 明确第一屏形态：三栏工具布局，不做 landing page
- [x] 明确第一版闭环：prompt、参考图、生成、编辑、历史、下载
- [x] 明确两种接入方式：简洁模式、自定义 Base URL

## Phase 1 - Design Baseline

- [x] 编写 Figma 设计 brief
- [x] 连接 Figma MCP 并确认目标文件
- [x] 因 Figma Starter 限制，先完成本地 HTML 高保真原型
- [x] 按 1920x1080、100% 浏览器缩放优化密度
- [ ] 解除 Figma MCP 限制后，将当前工作台设计回写到 Figma

## Phase 2 - App Scaffold

- [x] 初始化 Next.js + React + TypeScript 项目
- [x] 配置 `output: "standalone"`，准备 Docker 镜像
- [x] 建立目录：`app/`、`components/`、`lib/`、`types/`
- [x] 建立运行时配置：`GEMINI_BASE_URL`、`GEMINI_DEFAULT_MODEL`、`PUBLIC_BASE_URL_CONFIG`
- [x] 建立 i18n 字典：默认中文、英文备用
- [x] 建立全局 CSS 变量和三栏布局

## Phase 3 - Workbench UI

- [x] 左栏：API Key、可选 Base URL、模型选择、预设
- [x] 中栏：提示词、参考图上传、生成结果预览、主操作栏
- [x] 右栏：比例、生成数量、当前图片、历史记录
- [x] 根据接入方式显示或隐藏 Base URL 字段
- [x] 支持参考图类型/大小/数量限制
- [x] 支持结果下载
- [x] 支持把生成结果送回参考图继续编辑
- [x] 支持本地保存设置和历史记录

## Phase 4 - Gemini API Layer

- [x] 建立 `/api/generate` 服务端代理
- [x] 建立 `lib/providers/` provider adapter
- [x] UI 不直接拼 Gemini 请求
- [x] 自定义 Base URL 模式允许请求携带用户填写的 Base URL
- [x] 简洁模式忽略客户端 Base URL，只使用服务端 `GEMINI_BASE_URL`
- [x] 支持文生图请求
- [x] 支持参考图编辑请求
- [x] 统一鉴权、网络、模型、限流、无图返回等错误码
- [x] 避免在错误对象中泄露完整 API Key

## Phase 5 - Docker

- [x] 添加 `.dockerignore`
- [x] 添加 multi-stage `Dockerfile`
- [x] 添加 `docker-compose.yml`
- [x] 支持 `PORT`、`GEMINI_BASE_URL`、`GEMINI_DEFAULT_MODEL`、`PUBLIC_BASE_URL_CONFIG`
- [x] 验证 `npm run build`
- [x] 验证 `docker build`
- [x] 验证 `docker compose up`

## Phase 6 - Quality Pass

- [x] 验证 TypeScript 类型检查
- [x] 验证 Next.js 生产构建
- [x] 浏览器检查桌面视口
- [x] 浏览器检查窄屏视口
- [ ] 接入真实 Gemini API Key 做端到端生成验证

## Backlog

- [ ] IndexedDB 图片历史，替代 localStorage 的大图存储
- [ ] 批量生成
- [ ] 图片对比视图
- [ ] 工作台配置导入/导出
- [ ] 服务端共享 Key 模式
- [ ] Vertex AI 或其他 Gemini 兼容 provider
