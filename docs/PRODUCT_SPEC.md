# Product Spec

## Name

Gemini Image Desk

## Positioning

一个专门面向 Gemini 图像模型的图片生成与编辑工作台。它应该像创作软件一样直接、安静、可重复使用，而不是像展示站或营销页。

## Primary Users

- 经常用 Gemini/Nano Banana 做图像生成的人
- 需要快速测试 prompt、参考图和模型效果的开发者
- 希望自托管一个私有生图工作台的个人或小团队

## Core Workflow

1. 用户填写或选择 Base URL、API Key、模型。
2. 用户输入 prompt，可选上传一张或多张参考图。
3. 用户选择比例、生成数量等参数。
4. 点击生成。
5. 结果出现在主预览区，并写入历史。
6. 用户可以下载、删除、重新运行，或把结果发送到编辑区继续改图。

## First Version Features

- API 配置：Base URL、API Key、模型
- 文生图
- 图生图/参考图编辑
- 多参考图输入
- 比例选择：`1:1`、`16:9`、`9:16`、`4:3`、`3:4`
- 生成历史
- 下载图片
- 一键继续编辑
- 本地保存常用配置
- 清晰的加载、错误、空状态

## Explicit Non-Goals

- 不做聊天机器人。
- 不做公开社区图库。
- 不做账号、计费、多人协作。
- 不做复杂节点工作流。
- 不照抄 `img.1415.xin` 的视觉和布局。
- 不在第一版支持所有可能的 Gemini/Vertex/Imagen 参数。

## Information Architecture

### Left Panel

- API Key
- Base URL
- Model
- Presets
- Recent settings

### Center Stage

- Prompt editor
- Reference image tray
- Main result preview
- Generate button

### Right Panel

- Aspect ratio
- Output count
- Advanced parameters
- History
- Current image actions

## Success Criteria

- 用户 30 秒内能完成第一次生成。
- 生成结果可以直接继续编辑，不需要重新上传。
- API Key 不会出现在日志和错误信息里。
- 历史记录足够清楚：能看到缩略图、prompt、模型、时间。
- 桌面端体验像工作台，窄屏端也能完成核心流程。
