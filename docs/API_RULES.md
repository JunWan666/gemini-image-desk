# API Rules

## Provider Architecture

所有模型调用都必须通过 provider adapter 完成，React 组件不能直接拼 Gemini 请求。

当前结构：

```text
lib/
  providers/
    errors.ts
    types.ts
    gemini/
      client.ts
```

前端只调用统一接口：

```text
POST /api/generate
POST /api/models
```

## Runtime Modes

第一版只有两种接入方式。

接入方式由部署环境变量决定，页面只展示当前生效模式，不提供运行时切换按钮。

### 简洁模式

页面只显示 `API Key`，不显示 `Base URL`。

服务端使用：

```env
PUBLIC_BASE_URL_CONFIG=false
GEMINI_BASE_URL=https://generativelanguage.googleapis.com
```

适合自己部署、固定官方 Gemini endpoint、或固定一个代理地址。

### 自定义 Base URL

页面显示 `API Key` 和 `Base URL`。

服务端使用：

```env
PUBLIC_BASE_URL_CONFIG=true
GEMINI_BASE_URL=https://generativelanguage.googleapis.com
```

适合公开给别人用，让用户自己填写 Gemini 兼容端点。

修改方式：

1. 在项目根目录创建或编辑 `.env.local`。
2. 修改 `PUBLIC_BASE_URL_CONFIG`。
3. 重启开发服务：`npm run dev`。

## Request Rules

- 不在组件里拼接 Gemini endpoint。
- 不在组件里处理 provider-specific 的请求结构。
- 模型列表也必须通过 `/api/models` 获取，组件不得直接请求 Gemini `models` API。
- Base URL 在简洁模式下必须来自服务端配置。
- Base URL 在自定义模式下可以由用户填写。
- API Key 不写入仓库，不输出到日志。
- API Key 只在用户主动开启“本地保存 Key”时保存到浏览器本地。

## Error Rules

服务端统一返回用户可读错误码：

```ts
type ProviderErrorCode =
  | "auth"
  | "network"
  | "model"
  | "validation"
  | "no_image"
  | "rate_limit"
  | "unknown";
```

错误响应格式：

```ts
type ApiErrorResponse = {
  error: {
    code: ProviderErrorCode;
    message: string;
  };
};
```

## Security Rules

- 不提交真实 API Key。
- 不在 console、server log、error message 中输出完整 API Key。
- 用户清除 Key 后，本地状态也要清掉。
- 任何错误对象不得包含完整请求头。
- 服务端错误需要做脱敏处理。

## Local Storage Rules

允许保存：

- Base URL，仅自定义 Base URL 模式下保存
- 最近模型
- UI 语言
- 历史记录
- 用户明确允许保存的 API Key

不允许保存：

- 未经用户确认的 API Key
- 原始错误响应中的敏感 header
- 没有限制的大体积图片数据

## Compatibility Notes

Gemini 图像 API 能力会变化。模型 id、默认模型、Base URL 和 provider 参数要集中放在配置或 adapter 中，不能散落在 UI 组件里。
