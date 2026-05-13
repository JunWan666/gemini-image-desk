# Git 规则

本文档约定 Gemini Image Desk 的提交信息格式、提交前检查和推送安全规则。

## 提交信息格式

提交信息使用：

```text
编号-类型-摘要
```

示例：

```text
01-新增-完善图片生成与历史详情功能
02-新增-Docker一键部署配置
03-修复-历史缩略图居中裁切
04-文档-整理README界面预览
```

规则：

- `编号` 使用两位数字，从 `01` 开始递增。
- `类型` 使用中文短词，推荐：`新增`、`修复`、`优化`、`文档`、`重构`、`测试`、`构建`、`配置`、`安全`。
- `摘要` 用一句话说明本次改动，不以句号结尾。
- 一次提交只表达一个相对完整的改动主题。
- 不在提交信息里写 API Key、Token、Base64 密钥片段或其他敏感信息。

## 提交前检查

每次提交前必须先检查本次改动：

```bash
git status --short
git diff --stat
git diff --check
```

如果已经 `git add`，还要检查暂存区：

```bash
git diff --cached --stat
git diff --cached --check
```

重点确认：

- 本次提交只包含当前任务需要的文件。
- 没有把临时文件、构建产物、依赖目录或本地配置提交进去。
- 没有意外混入与当前任务无关的修改。

## 忽略文件检查

提交前查看是否有不必要文件进入未跟踪或暂存状态：

```bash
git status --ignored --short
```

这些内容默认不应提交：

- `.env`、`.env.local`、`.env.*.local`
- `.next/`、`out/`、`dist/`、`build/`
- `node_modules/`
- `*.log`
- `*.tsbuildinfo`
- 本地浏览器截图、临时检查图片、编辑器缓存

如果发现新的生成物或本地文件经常出现，应优先调整 `.gitignore`，再继续提交。

## README 同步检查

提交前根据本次改动判断是否需要同步 `README.md` 或 `docs/`：

- 改了启动方式、环境变量、Docker、部署流程，需要更新 README。
- 改了主要功能、截图、模型说明、工作流，需要更新 README。
- 改了 API 约定、provider、错误处理，需要更新 `docs/API_RULES.md` 或架构文档。
- 改了 i18n、设计规则、产品边界，需要更新对应文档。

如果改动会影响用户如何安装、运行、配置或理解产品，README 必须跟着更新。

## 密钥与敏感信息检查

提交或推送前必须检查是否带入密钥相关内容：

```bash
git diff
git diff --cached
```

重点搜索：

- `API_KEY`
- `GEMINI_API_KEY`
- `Authorization`
- `Bearer `
- `AIza`
- `sk-`
- `private_key`
- `BEGIN PRIVATE KEY`
- `access_token`
- `refresh_token`

如果发现疑似真实密钥、Token、私有证书、含 Key 的截图或完整鉴权请求：

1. 立即停止提交或推送。
2. 不要在提交信息、日志或回复中输出完整密钥。
3. 先询问项目负责人是否继续上传。
4. 默认应删除敏感内容、改用 `.env.example` 或脱敏示例后再提交。

没有明确确认前，不允许继续提交或推送包含敏感信息的改动。

## 验证要求

提交前至少运行：

```bash
npm run typecheck
```

如果本次改动涉及构建、部署或核心流程，按风险补充运行：

```bash
npm run build
```

如果无法运行验证，需要在提交说明或协作消息中明确说明原因。

## 推送规则

- 初始化或普通改动可以先 commit，不默认 push。
- 只有用户明确要求上传、推送、发布或同步远程仓库时，才执行 `git push`。
- 推送前再次确认 remote、当前分支和待推送提交：

```bash
git remote -v
git branch --show-current
git log --oneline --decorate -5
```
